(function($) {
  Convos.api = new swaggerClient();
  Convos.ws = new ReconnectingWebSocket(Convos.wsUrl);
  Convos.ws.on('open', function() {
    Convos.api.load(Convos.apiUrl, function(err) {
      Convos.user = new Convos.User(); // Convos.user is only for debug purposes and must not be accessed by riot tags
      Convos.user.load(function(err) {
        if (err && err[0].path == '/') err = [];
        riot.mount(document.getElementById('app'), 'app', {errors: err || [], user: this});
        clearTimeout(Convos.loadTid); // Set in Convos.pm app.html.ep
      });
    });
  });
  Convos.ws.open();
})(jQuery);
