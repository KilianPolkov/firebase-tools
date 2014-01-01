var optimist = require('optimist'),
    http = require('http'),
    https = require('https'),
    argv = optimist.argv,
    fs = require('fs'),
    path = require('path'),
    zlib = require('zlib'),
    tar = require('tar'),
    url = require('url'),
    prompt = require('prompt'),
    Auth = require('./auth');

var supportedTemplates = {
  'angular': {
    'url': 'https://codeload.github.com/firebase/angularFire-seed/legacy.tar.gz/master',
    'public': '.' + path.sep + 'app',
    'rules': '.' + path.sep + 'config' + path.sep + 'security-rules.json',
    'config': './app/js/config.js',
    'configRegex': /INSTANCE/
  }
};

var routes = {
  init: function() {
    this.settingsFile = path.resolve('./firebase.json');
    if (fs.existsSync(this.settingsFile)) {
      console.log('Directory already initialized');
      return;
    }
    var that = this,
        schema = {
          properties: {
            firebase: {
              required: true,
              pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9]|)$/,
              description: 'Firebase',
              message: 'Please enter the firebase you wish to associate this ' +
                       'app with'
            }
          }
        };
    prompt.get(schema, function(err, result) {
      if (err) {
        return;
      }
      console.log('Initializing app into current directory');
      Auth.checkCanAccess(result.firebase, function(err) {
        if (err) {
          console.log('You do not have permission to use that Firebase');
          return;
        }
        console.log('Writing firebase.json settings file');
        var settings = {
          'firebase': result.firebase,
          'public': '.', // TODO: prompt for public directory?
          'rules': '.' + path.sep + 'rules.json'
        };
        var settingsJSON = JSON.stringify(settings, null, 2) + "\n";
        try {
          fs.writeFileSync(that.settingsFile, settingsJSON);
          console.log('Done')
        } catch(err) {
          console.log('Could not initialize app');
        }
      });
    });
  },
  bootstrap: function() {
    var that = this,
        schema = {
          properties: {
            firebase: {
              required: true,
              pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9]|)$/,
              description: 'Firebase',
              message: 'Please enter the firebase you wish to associate this ' +
                       'app with'
            },
            template: {
              required: true,
              pattern: /^[a-z]+$/,
              description: 'Template',
              message: 'Please enter a valid template'
            }
          }
        };
    prompt.get(schema, function(err, result) {
      if (err) {
        return;
      }
      if (!supportedTemplates.hasOwnProperty(result.template)) {
        console.log('Template not supported. Available templates are:');
        console.log(Object.keys(supportedTemplates).join(', '));
        return;
      }
      Auth.checkCanAccess(result.firebase, function(err) {
        if (err) {
          console.log('You do not have permission to use that Firebase');
          return;
        }

        var dir = result.firebase;
        var projectDir = path.resolve(dir);
        if (fs.existsSync(projectDir)) {
          var i = 1;
          do {
            dir = result.firebase + '_' + i++;
            projectDir = path.resolve(dir);
          } while (fs.existsSync(projectDir));
        }
        console.log('Creating directory ' + dir);
        try {
          fs.mkdirSync(projectDir, '0755');
        } catch(err) {
          console.log('Could not create new directory');
          return;
        }

        console.log('Downloading and unpacking template');
        var gunzip = zlib.createGunzip();
        var untar = tar.Extract({
          path: projectDir,
          strip: 1
        });
        var urlParts = url.parse(supportedTemplates[result.template].url);
        var protocol, port;
        if (urlParts.protocol === 'https:') {
          protocol = https;
          port = 443;
        } else {
          protocol = http;
          port = 80;
        }
        if (urlParts.port) {
          port = urlParts.port;
        }
        var request = protocol.get({
          host: urlParts.hostname,
          path: urlParts.pathname,
          port: port
        });
        request.on('response', function(response) {
          try {
            response.pipe(gunzip).pipe(untar);
          } catch (err) {
            console.log('Could not download template');
            return
          }
          response.on('end', function() {
            var config = path.join(
                           projectDir,
                           supportedTemplates[result.template].config
                         );
            try {
              var data = fs.readFileSync(config, 'utf8');
              var replaced = data.replace(
                               supportedTemplates[result.template].configRegex,
                               result.firebase
                             );
              fs.writeFileSync(config, replaced);
            } catch (err) {
              console.log(err);
              console.log('Couldn\'t update template with project settings');
              return;
            }

            console.log('Writing firebase.json settings file');
            var settings = {
              'firebase': result.firebase,
              'public': supportedTemplates[result.template]['public'],
              'rules': supportedTemplates[result.template]['rules']
            };
            var settingsJSON = JSON.stringify(settings, null, 2) + "\n";
            var settingsFile = path.join(projectDir, 'firebase.json');
            try {
              fs.writeFileSync(settingsFile, settingsJSON);
            } catch(err) {
              console.log('Could not save settings file');
              return;
            }
            console.log('Done');
          });
        });
      });
    });
  },
  deploy: function() {
    console.log('deploy');
  }
};

function App() {
  var that = this;
  if ((argv._.length > 1) && (routes.hasOwnProperty(argv._[1]))) {
    Auth.requireLogin(function(err) {
      if (err) {
        console.log("Sorry, we couldn't log you in");
        return;
      }
      routes[argv._[1]].bind(that)();
    });
  } else {
    // TODO: Print module level help
    optimist.showHelp();
  }
}

module.exports = App;