(function() {
  /**
   * @file Generate object for communicating with an OpenAPI backend.
   * @version 0.13.0
   * @author Jan Henning Thorsen
   * @copyright Jan Henning Thorsen 2016
   * @license Artistic License version 2.0.
   */

  /**
   * Generates a new client from an OpenAPI specification.
   * Note that the specification specification cannot contain "$ref" and need
   * to be in JSON format.
   * @class
   * @param {(string|Object)} spec - Either an object representing an OpenAPI spec or the URL to the OpenAPI specification file.
   * @param {function} [cb] - Function to call when the spec URL is downloaded.
   * @example
   * var client = new openAPI().load(url, function(err) {
   *   if (err) throw err;
   *   this.listPets({limit: 10}, function(err, xhr) {
   *     console.log(xhr.code, xhr.body);
   *   });
   * });
   */
  window.openAPI = function(spec, cb) {
    this._xhr = {};
    if (typeof spec == "object") return this._generate(spec);
    if (typeof spec == "string") return this.load(spec, cb);
  };

  var proto = window.openAPI.prototype;
  var makeErr;

  /**
   * Used to load a specification and generate methods.
   * @return {Object} client - Self.
   * @example
   * client = client.load(url, function(err) { });
   */
  proto.load = function(url, cb) {
    var xhr = new XMLHttpRequest();

    xhr.open("GET", url);
    xhr.onreadystatechange = function() {
      if (xhr.readyState != 4) return;
      if (xhr.status != 200) return cb.call(this, xhr.status);
      if (window.DEBUG == 1) console.log("[OpenAPI] Generate methods from " + url);
      this._generate(xhr.responseText.match(/^[\{\[]/) ? JSON.parse(xhr.responseText) : {});
      cb.call(this, "");
    }.bind(this);
    xhr.send(null);

    return this;
  };

  // Generate methods from spec
  proto._generate = function(spec) {
    var self = this;
    this.baseUrl = (spec.basePath || "").replace(/\/$/, "");

    Object.keys(spec.paths).forEach(function(path) {
      if (path.indexOf("/") != 0) return;
      Object.keys(spec.paths[path]).forEach(function(httpMethod) {
        if (!httpMethod.match(/^\w+$/)) return;
        var opSpec   = spec.paths[path][httpMethod];
        var pathList = path.split("/");
        httpMethod = httpMethod.toUpperCase();
        pathList.shift(); // first element is empty string

        if (window.DEBUG == 2) console.log("[OpenAPI] Add method " + opSpec.operationId);
        self[opSpec.operationId] = function(input, cb) {
          var xhr = this._xhrReq(httpMethod, pathList, input, opSpec.parameters || []);

          if (xhr.errors) {
            setTimeout(function() {
              cb.call(this, xhr.errors, xhr);
            }.bind(this), 0);
          } else {
            xhr.onreadystatechange = function() {
              if (xhr.readyState != 4) return;
              if (window.DEBUG) console.log("[OpenAPI] " + xhr.url + " " + xhr.status + " " + xhr.responseText);
              xhr.body = xhr.responseText.match(/^[\{\[]/) ? JSON.parse(xhr.responseText) : xhr.responseText;
              cb.call(this, makeErr(xhr), xhr);
            }.bind(this);
            xhr.send(xhr.body);
            delete xhr.body;
          }
        };
      });
    });

    return this;
  };

  // Create a request
  proto._xhrReq = function(httpMethod, pathList, input, parameters) {
    var xhr   = new XMLHttpRequest();
    var form  = [],
      headers = [],
      json    = null,
      query   = [],
      str;
    var url    = [this.baseUrl];
    var errors = [];

    pathList.forEach(function(p) {
      url.push(p.replace(/\{(\w+)\}/, function(m, n) {
        if (typeof input[n] == "undefined") errors.push({
            message: "Missing input: " + n,
            path:    "/" + n
          });
        return encodeURIComponent(input[n]);
      }));
    });

    xhr.body = null;
    xhr.url  = url.join("/");

    for (i = 0; i < parameters.length; i++) {
      var p     = parameters[i];
      var name  = p.name;
      var value = input[name];

      if (typeof value == "undefined") {
        value = p["default"];
      }
      if (typeof value == "undefined") {
        if (p.required) errors.push({
            message: "Missing input: " + name,
            path:    "/" + name
          });
        continue;
      }

      switch (p["in"]) {
        case "body":
          json = value;
          break;
        case "file":
          xhr.body = value;
          break;
        case "formData":
          form.push([name, value]);
          break;
        case "header":
          headers.push([name, value]);
          break;
        case "query":
          query.push([name, value]);
          break;
      }
    }

    if (errors.length) {
      if (window.DEBUG) console.log("[OpenAPI] " + xhr.url + " = " + JSON.stringify(errors));
      xhr.errors = errors;
      return xhr;
    }
    if (query.length) {
      str = [];
      query.forEach(function(i) {
        str.push(encodeURIComponent(i[0]) + "=" + encodeURIComponent(i[1]));
      });
      xhr.url += "?" + str.join("&");
    }

    if (json) {
      headers.unshift(["Content-Type", "application/json"]);
      xhr.body = JSON.stringify(json);
      if (window.DEBUG == 2) console.log("[OpenAPI] " + xhr.url + " <<< " + xhr.body);
    } else if (form.length) {
      str = [];
      headers.unshift(["Content-Type", "application/x-www-form-urlencoded"]);
      form.forEach(function(i) {
        str.push(encodeURIComponent(i[0]) + "=" + encodeURIComponent(i[1]));
      });
      xhr.body = str.join("&");
      if (window.DEBUG == 2) console.log("[OpenAPI] " + xhr.url + " <<< " + xhr.body);
    }

    xhr.open(httpMethod, xhr.url);
    headers.forEach(function(i) {
      xhr.setRequestHeader(i[0], i[1]);
    });

    return xhr;
  };

  var makeErr = function(xhr) {
    var errors = xhr.body.errors || [];
    if (xhr.status == 200) return null;
    if (errors.length) return errors;
    if (!xhr.status)
      xhr.status = 408;
    return [{
      message: "Request failed! Try again later. (" + xhr.status + ")",
      path:    xhr.url
    }];
  };
})();
