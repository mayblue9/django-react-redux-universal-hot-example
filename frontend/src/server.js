import Express from 'express';
import React from 'react';
import Location from 'react-router/lib/Location';
import config from './config';
import favicon from 'serve-favicon';
import compression from 'compression';
import httpProxy from 'http-proxy';
import path from 'path';
import createStore from './redux/create';
import ApiClient from './ApiClient';
import universalRouter from './universalRouter';
import Html from './Html';
import PrettyError from 'pretty-error';

const pretty = new PrettyError();
const app = new Express();
const api_proxy = httpProxy.createProxyServer({
  target: 'http://localhost:' + config.apiPort + '/api/'
});

const admin_proxy = httpProxy.createProxyServer({
  target: 'http://localhost:' + config.apiPort + '/admin/'
});

const static_proxy = httpProxy.createProxyServer({
  target: 'http://localhost:' + config.apiPort + '/static/'
});

const media_proxy = httpProxy.createProxyServer({
  target: 'http://localhost:' + config.apiPort + '/media/'
});


app.use(compression());
app.use(favicon(path.join(__dirname, '..', 'static', 'favicon.ico')));

app.use(require('serve-static')(path.join(__dirname, '..', 'static')));

app.use('/api', (req, res) => { api_proxy.web(req, res); });
app.use('/admin', (req, res) => { admin_proxy.web(req, res); });
app.use('/static', (req, res) => { static_proxy.web(req, res); });
app.use('/media', (req, res) => { media_proxy.web(req, res); });


app.use((req, res) => {
  if (__DEVELOPMENT__) {
    // Do not cache webpack stats: the script file would change since
    // hot module replacement is enabled in the development env
    webpackIsomorphicTools.refresh();
  }
  const client = new ApiClient(req);
  const store = createStore(client);
  const location = new Location(req.path, req.query);
  if (__DISABLE_SSR__) {
    res.send('<!doctype html>\n' +
      React.renderToString(<Html assets={webpackIsomorphicTools.assets()} component={<div/>} store={store}/>));
  } else {
    universalRouter(location, undefined, store)
      .then(({component, transition, isRedirect}) => {
        if (isRedirect) {
          res.redirect(transition.redirectInfo.pathname);
          return;
        }
        res.send('<!doctype html>\n' +
          React.renderToString(<Html assets={webpackIsomorphicTools.assets()} component={component} store={store}/>));
      })
      .catch((error) => {
        if (error.redirect) {
          res.redirect(error.redirect);
          return;
        }
        console.error('ROUTER ERROR:', pretty.render(error));
        res.status(500).send({error: error.stack});
      });
  }
});

if (config.port) {
  app.listen(config.port, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.info('==> ✅  Server is listening');
      console.info('==> 🌎  %s running on port %s', config.app.name, config.port);
      console.info('API is assumed to present at port %s; please make sure it\'s running!', config.apiPort);
      console.info('----------\n==> 💻  Open http://localhost:%s in a browser to view the app.', config.port);
    }
  });
} else {
  console.error('==> ERROR: No PORT environment variable has been specified');
}
