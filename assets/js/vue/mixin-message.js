(function() {
  Convos.mixin.message = {
    props:   ["dialog", "msg", "user"],
    methods: {
      classNames: function() {
        var msg = this.msg;
        var c = {highlight: this.msg.highlight ? true : false};

        if (msg.type == "private" && msg.message && msg.from == msg.prev.from) {
          c["same-user"] = true;
        }
        else {
          c["changed-user"] = true;
        }

        return c;
      },
      loadOffScreen: function(html, id) {
        if (html.match(/^<a\s/)) return;

        // TODO: Add support for showing paste inline
        if (html.match(/class=".*(text-paste|text-gist-github)/)) return;

        var self = this;
        var $html = $(html);
        var $a = $('#' + id);

        $html.filter("img").add($html.find("img")).addClass("embed materialboxed");
        $a.parent().append($html).find(".materialboxed").materialbox();

        $html.find("img, iframe").each(function() {
          $(this).css("height", "1px").load(function() {
            if (self.$parent.atBottom) self.$parent.scrollToBottom(true);
            $(this).css("height", "auto");
          });
        });
      },
      message: function() {
        var self = this;
        return this.msg.message.xmlEscape().autoLink({
          target: "_blank",
          after:  function(url, id) {
            $.get("/api/embed?url=" + encodeURIComponent(url), function(html, textStatus, xhr) {
              self.loadOffScreen(html, id);
            });
          }
        });
      }
    }
  };
})();
