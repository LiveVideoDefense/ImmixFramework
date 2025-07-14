const { randomUUID } = require('crypto');
var proxyServer = undefined;
var immixFramework = undefined;

function setDefaults(proxy, framework) {
  proxyServer = proxy;
  immixFramework = framework;
}

function authorizeBasic(username, password) {
  return new Promise((resolve, reject) => {
    var requestID = randomUUID();
    proxyServer.puppetPage("http://localhost:" + immixFramework.Config.proxySettings.port + immixFramework.Config.proxySettings.proxyAPI + "basicLogon?pEndpoint=" + immixFramework.Config.proxySettings.proxyEndpoint + "&username=" + username + "&password=" + password + "&port=" + immixFramework.Config.proxySettings.port + "&requestID=" + requestID, undefined).then(() => {
      proxyServer.createProxyRequest(requestID).then(req => {
        resolve({ success: req.success, error: req.error, cookie: req.cookie });
      }).catch(req => {
        reject({ success: req.success, error: req.error, cookie: undefined });
      });
    }).catch(status => {
      reject({ success: false, error: new Error(status.error), cookie: undefined });
    });
  })
};

module.exports = {
  authorizeBasic,
  setDefaults
}