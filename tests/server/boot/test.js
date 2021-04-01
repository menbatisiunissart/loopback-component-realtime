module.exports = function (app) {
  app.on('started', function () {
    console.log('IO STARTED?');
    app.mx.IO.on('test', function (message) {
      console.log('RESPONSE: ', message);
    });
    app.mx.IO.on('new-message', function (message) {
      console.log('MESSAGE: ', message);
    });
  });
};
