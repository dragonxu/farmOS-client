import logFactory, { SERVER } from './logFactory';
import farmSync from './farmSync';

// Just for testing
const host = '';
const user = 'farmos';
const password = 'farmos';

const farm = farmSync(host, user, password);

export default {
  actions: {
    // This is just a testing implementation, the real deal's in loginModule
    authenticate() {
      farm.authenticate()
        .then(console.log).catch(console.error);
    },
    getAreas() {
      farm.area.get().then(console.log).catch(console.error);
    },
    getAssets() {
      farm.asset.get().then(console.log).catch(console.error);
    },
    getLogs() {
      farm.log.get().then(console.log).catch(console.error);
    },
    updateAreas({ commit, rootState }) {
      // Return a promise, so if it fails, the DB can be checked
      return new Promise((resolve, reject) => {
        farm.area.get().then((res) => {
          const areas = res.reduce((acc, { tid, name }) => {
            const storeIndex = rootState.farm.areas.findIndex(a => a.id === tid);
            if (storeIndex === -1) {
              return acc.concat({ tid, name });
            }
            commit('updateArea', { tid, name });
            return acc;
          }, []);
          commit('addAreas', areas);
          console.log('Finished updating areas!');
          resolve();
        }).catch(reject);
      });
    },
    updateAssets({ commit, rootState }) {
      // Return a promise, so if it fails, the DB can be checked
      return new Promise((resolve, reject) => {
        farm.asset.get().then((res) => {
          const assets = res.reduce((acc, { id, name }) => {
            const storeIndex = rootState.farm.assets.findIndex(a => a.id === id);
            if (storeIndex === -1) {
              return acc.concat({ id, name });
            }
            commit('updateAsset', { id, name });
            return acc;
          }, []);
          commit('addAssets', assets);
          console.log('Finished updating assets!');
          resolve();
        }).catch(reject);
      });
    },

    // SEND LOGS TO SERVER
    sendLogs({ commit, rootState }, payload) {
      function handleSyncResponse(response, index) {
        commit('updateLogs', {
          indices: [index],
          mapper(log) {
            return logFactory({
              ...log,
              id: response.id,
              wasPushedToServer: true,
              remoteUri: response.uri,
            });
          },
        });
      }

      function handleSyncError(error, index) {
        // Do something with a TypeError object (mostly likely no connection)
        if (typeof error === 'object' && error.status === undefined) {
          const errorPayload = {
            message: `Unable to sync "${rootState.farm.logs[index].name}" because the network is currently unavailable. Please try syncing again later.`,
            errorCode: error.statusText,
            level: 'warning',
            show: true,
          };
          commit('logError', errorPayload);
        } else if (error.status === 401 || error.status === 403) {
          // Reroute authentication or authorization errors to login page
          payload.router.push('/login');
        } else {
          // handle some other type of runtime error (if possible)
          const errorPayload = {
            message: `${error.status} error while syncing "${rootState.farm.logs[index].name}": ${error.statusText}`,
            errorCode: error.statusText,
            level: 'warning',
            show: true,
          };
          commit('logError', errorPayload);
        }
        commit('updateLogs', {
          indices: [index],
          mapper(log) {
            return logFactory({
              ...log,
              isReadyToSync: false,
            });
          },
        });
      }

      // Send records to the server, unless the user isn't logged in
      if (localStorage.getItem('token')) {
        payload.indices.map((index) => {
          const newLog = logFactory(rootState.farm.logs[index], SERVER);
          return farm.log.send(newLog, localStorage.getItem('token')) // eslint-disable-line no-use-before-define, max-len
            .then(res => handleSyncResponse(res, index))
            .catch(err => handleSyncError(err, index));
        });
      } else {
        payload.router.push('/login');
      }
    },

  },
};