"use strict";

import axios from 'axios';
import createHmac from 'create-hmac';
import OAuth from 'oauth-1.0a';

/**
 * WooCommerce REST API wrapper
 *
 * @param {Object} opt
 */
export default class WooCommerceAPI {

  /**
   * Class constructor.
   *
   * @param {Object} opt
   */
  constructor(opt) {
    if (!(this instanceof WooCommerceAPI)) {
      return new WooCommerceAPI(opt);
    }

    opt = opt || {};

    if (!(opt.url)) {
      throw new Error('url is required');
    }

    if (!(opt.consumerKey)) {
      throw new Error('consumerKey is required');
    }

    if (!(opt.consumerSecret)) {
      throw new Error('consumerSecret is required');
    }

    this.classVersion = '0.0.1';
    this._setDefaultsOptions(opt);
  }

  /**
   * Set default options
   *
   * @param {Object} opt
   */
  _setDefaultsOptions(opt) {
    this.url             = opt.url;
    this.wpAPIPrefix     = opt.wpAPIPrefix || 'wp-json';
    this.version         = opt.version || 'v3';
    this.isHttps         = /^https/i.test(this.url);
    this.consumerKey     = opt.consumerKey;
    this.consumerSecret  = opt.consumerSecret;
    this.verifySsl       = opt.verifySsl || true;
    this.encoding        = opt.encoding || 'utf8';
    this.queryStringAuth = opt.queryStringAuth || false;
    this.port            = opt.port || '';
    this.timeout         = opt.timeout;
    this.axiosOptions    = opt.axiosOptions || {};
  }

  /**
   * Parse params object.
   *
   * @param {String} params
   * @param {URLSearchParams} searchParams
   */
  _parseParamsObject(params, searchParams) {
    for (const key in params) {
      const value = params[key];

      if (typeof value === 'object') {
        // parseParamsObject(value, searchParams);
        for (const prop in value) {
          searchParams.set(key.toString() + "[" + prop.toString() + "]", value[prop]);
        }
      } else {
        searchParams.set(key, value);
      }
    }
  }

  /**
   * Normalize query string for oAuth
   *
   * @param  {String} url
   * @param  {Object} params
   *
   * @return {String}
   */
  _normalizeQueryString(url, params) {
    // Exit if don't find query string.
    if (url.indexOf('?') === -1 && Object.keys(params).length === 0) {
      return url;
    }

    const query  = new URL(url).searchParams;
    const values = [];

    let queryString = '';

    // Include params object into URL.searchParams.
    this._parseParamsObject(params, query);

    query.forEach(function(value, key) {
      values.push(key);
    });
    values.sort();

    for (const i in values) {
      if (queryString.length) {
        queryString += '&';
      }

      queryString += encodeURIComponent(values[i]).replace(/%5B/g, '[').replace(/%5D/g, ']');
      queryString += '=';
      queryString += encodeURIComponent(query.get(values[i]));
    }

    return url.split('?')[0] + '?' + queryString;
  }

  /**
   * Get URL
   *
   * @param  {String} endpoint
   * @param  {Object} params
   *
   * @return {String}
   */
  _getUrl(endpoint, params) {
    const api = this.wpAPIPrefix + '/';

    let url = this.url.slice(-1) === '/' ? this.url : this.url + '/';

    url = url + api + this.version + '/' + endpoint;

    // Include port.
    if (this.port !== '') {
      const hostname = new URL(url).hostname;

      url = url.replace(hostname, hostname + ':' + this.port);
    }


    if (!this.isHttps) {
      return this._normalizeQueryString(url, params);
    }

    return url;
  }

  /**
   * Get OAuth
   *
   * @return {Object}
   */
  _getOAuth() {
    const data = {
      consumer: {
        key: this.consumerKey,
        secret: this.consumerSecret
      },
      signature_method: 'HMAC-SHA256',
      hash_function: function(base, key) {
        return createHmac('sha256', key).update(base).digest('base64');
      }
    };

    return new OAuth(data);
  }

  /**
   * Do requests
   *
   * @param  {String} method
   * @param  {String} endpoint
   * @param  {Object} data
   * @param  {Object} params
   *
   * @return {Object}
   */
  _request(method, endpoint, data, params = {}) {
    const url = this._getUrl(endpoint, params);

    let options = {
      url: url,
      method: method,
      responseEncoding: this.encoding,
      timeout: this.timeout,
      responseType: 'json',
      headers: {
        'User-Agent': 'WooCommerce REST API - JS Client/' + this.classVersion,
        'Accept': 'application/json'
      }
    };

    if (this.isHttps) {
      if (this.queryStringAuth) {
        options.params = {
          consumer_key: this.consumerKey,
          consumer_secret: this.consumerSecret
        };
      } else {
        options.auth = {
          username: this.consumerKey,
          password: this.consumerSecret
        };
      }

      options.params = {...options.params, ...params}

      if (!this.verifySsl) {
        options.strictSSL = false;
      }
    } else {
      options.params = this._getOAuth().authorize({
        url: url,
        method: method
      });
    }

    if (data) {
      options.headers['Content-Type'] = 'application/json;charset=utf-8';
      options.data = JSON.stringify(data);
    }

    // Allow set and override Axios options.
    options = {...options, ...this.axiosOptions};

    return axios(options);
  }

  /**
   * GET requests
   *
   * @param  {String} endpoint
   * @param  {Object} params
   *
   * @return {Object}
   */
  get(endpoint, params = {}) {
    return this._request('get', endpoint, null, params);
  }

  /**
   * POST requests
   *
   * @param  {String} endpoint
   * @param  {Object} data
   * @param  {Object} params
   *
   * @return {Object}
   */
  post(endpoint, data, params = {}) {
    return this._request('post', endpoint, data, params);
  }

  /**
   * PUT requests
   *
   * @param  {String} endpoint
   * @param  {Object} data
   * @param  {Object} params
   *
   * @return {Object}
   */
  put(endpoint, data, params = {}) {
    return this._request('put', endpoint, data, params);
  }

  /**
   * DELETE requests
   *
   * @param  {String} endpoint
   * @param  {Object} params
   * @param  {Object} params
   *
   * @return {Object}
   */
  delete(endpoint, params = {}) {
    return this._request('delete', endpoint, null, params);
  }

  /**
   * OPTIONS requests
   *
   * @param  {String} endpoint
   * @param  {Object} params
   *
   * @return {Object}
   */
  options(endpoint, params = {}) {
    return this._request('options', endpoint, null, params);
  }
}