'use strict'

const querystring = require('querystring')

const executeRequest = require('./executeRequest')

var axios = require('axios');
var got = require('got');

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/auth'
const GOOGLE_API_HOST = 'https://www.googleapis.com'
const GOOGLE_API_PATH = '/oauth2/v3/token'
const GOOGLE_API_PATH_NEW = '/oauth2/v4/token'

const PICASA_SCOPE = 'https://picasaweb.google.com/data'
const PICASA_API_FEED_PATH = '/feed/api/user/default'
const PICASA_API_ENTRY_PATH = '/entry/api/user/default'

const FETCH_AS_JSON = 'json'

function Picasa() {
  this.executeRequest = executeRequest
}

Picasa.prototype.getPhotos = getPhotos
Picasa.prototype.postPhoto = postPhoto
Picasa.prototype.deletePhoto = deletePhoto
Picasa.prototype.getAlbums = getAlbums
Picasa.prototype.createAlbum = createAlbum

//Video 
Picasa.prototype.getVideos = getVideos
Picasa.prototype.createResumableVideo = createResumableVideo
Picasa.prototype.postVideo = postVideo
Picasa.prototype.resumeUpload = resumeUpload
// Auth utilities
Picasa.prototype.getAuthURL = getAuthURL
Picasa.prototype.getAccessToken = getAccessToken
Picasa.prototype.renewAccessToken = renewAccessToken

function getAlbums(accessToken, options, callback) {
  const accessTokenParams = {
    alt: FETCH_AS_JSON,
    access_token: accessToken
  }

  options = options || {}

  const requestQuery = querystring.stringify(accessTokenParams)

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_FEED_PATH}?${requestQuery}`,
    headers: {
      'GData-Version': '2'
    }
  }

  this.executeRequest('get', requestOptions, (error, body) => {
    if (error) return callback(error)

    const albums = body.feed.entry.map(
      entry => parseEntry(entry, albumSchema)
    )

    callback(null, albums)
  })
}

function deletePhoto(accessToken, albumId, photoId, callback) {
  const requestQuery = querystring.stringify({
    alt: FETCH_AS_JSON,
    access_token: accessToken
  })

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_ENTRY_PATH}/albumid/${albumId}/photoid/${photoId}?${requestQuery}`,
    headers: {
      'If-Match': '*'
    }
  }

  this.executeRequest('del', requestOptions, callback)
}

function createAlbum(accessToken, albumData, callback) {
  const requestQuery = querystring.stringify({
    alt: FETCH_AS_JSON,
    access_token: accessToken
  })

  const albumInfoAtom = `<entry xmlns='http://www.w3.org/2005/Atom'
                            xmlns:media='http://search.yahoo.com/mrss/'
                            xmlns:gphoto='http://schemas.google.com/photos/2007'>
                          <title type='text'>${albumData.title}</title>
                          <summary type='text'>${albumData.summary}</summary>
                          <gphoto:access>private</gphoto:access>
                          <category scheme='http://schemas.google.com/g/2005#kind'
                            term='http://schemas.google.com/photos/2007#album'></category>
                         </entry>`

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_FEED_PATH}?${requestQuery}`,
    body: albumInfoAtom,
    headers: { 'Content-Type': 'application/atom+xml' }
  }

  this.executeRequest('post', requestOptions, (error, body) => {
    if (error) return callback(error)

    const album = parseEntry(body.entry, albumSchema)

    callback(error, album)
  })
}

function postPhoto(accessToken, albumId, photoData, callback) {
  const requestQuery = querystring.stringify({
    alt: FETCH_AS_JSON,
    access_token: accessToken
  })

  const photoInfoAtom = `<entry xmlns="http://www.w3.org/2005/Atom">
                          <title>${photoData.title}</title>
                          <summary>${photoData.summary}</summary>
                          <category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/photos/2007#photo"/>
                        </entry>`

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_FEED_PATH}/albumid/${albumId}?${requestQuery}`,
    multipart: [
      { 'Content-Type': 'application/atom+xml', body: photoInfoAtom },
      { 'Content-Type': photoData.contentType, body: photoData.binary }
    ]
  }

  this.executeRequest('post', requestOptions, (error, body) => {
    if (error) return callback(error)

    const photo = parseEntry(body.entry, photoSchema)

    callback(error, photo)
  })
}

function getPhotos(accessToken, options, callback) {
  const accessTokenParams = {
    alt: FETCH_AS_JSON,
    kind: 'photo',
    access_token: accessToken
  }

  options = options || {}

  if (options.maxResults) accessTokenParams['max-results'] = options.maxResults
  if (options.startIndex) accessTokenParams['start-index'] = options.startIndex

  const albumPart = options.albumId ? `/albumid/${options.albumId}` : ''

  const requestQuery = querystring.stringify(accessTokenParams)

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_FEED_PATH}${albumPart}?${requestQuery}`,
    headers: {
      'GData-Version': '2'
    }
  }

  this.executeRequest('get', requestOptions, (error, body) => {
    if (error) return callback(error)

    const photos = body.feed.entry.map(
      entry => parseEntry(entry, photoSchema)
    )

    callback(null, photos)
  })
}

const albumSchema = {
  'gphoto$id': 'id',
  'gphoto$name': 'name',
  'gphoto$numphotos': 'num_photos',
  'published': 'published',
  'title': 'title',
  'summary': 'summary',
  'gphoto$location': 'location',
  'gphoto$nickname': 'nickname'
}

const photoSchema = {
  'gphoto$id': 'id',
  'gphoto$albumid': 'album_id',
  'gphoto$access': 'access',
  'gphoto$width': 'width',
  'gphoto$height': 'height',
  'gphoto$size': 'size',
  'gphoto$checksum': 'checksum',
  'gphoto$timestamp': 'timestamp',
  'gphoto$imageVersion': 'image_version',
  'gphoto$commentingEnabled': 'commenting_enabled',
  'gphoto$commentCount': 'comment_count',
  'content': 'content',
  'title': 'title',
  'summary': 'summary'
}

function parseEntry(entry, schema) {
  let photo = {}

  Object.keys(schema).forEach(schemaKey => {
    const key = schema[schemaKey]

    if (key) {
      const value = checkParam(entry[schemaKey]);

      photo[key] = value;
    }
  })

  return photo
}

function getAuthURL(config) {
  const authenticationParams = {
    access_type: 'offline',
    scope: `${PICASA_SCOPE}`,
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectURI
  }

  const authenticationQuery = querystring.stringify(authenticationParams)

  return `${GOOGLE_AUTH_ENDPOINT}?${authenticationQuery}`
}

function getAccessToken(config, code, callback) {
  const accessTokenParams = {
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: config.redirectURI,
    client_id: config.clientId,
    client_secret: config.clientSecret
  }

  const requestQuery = querystring.stringify(accessTokenParams)
  const options = {
    url: `${GOOGLE_API_HOST}${GOOGLE_API_PATH}?${requestQuery}`
  }

  this.executeRequest('post', options, (error, body) => {
    if (error) return callback(error)

    callback(null, body.access_token, body.refresh_token)
  })
}

function renewAccessToken(config, refresh_token, callback) {
  const refreshTokenParams = {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refresh_token
  }

  const requestQuery = querystring.stringify(refreshTokenParams)
  const options = {
    url: `${GOOGLE_API_HOST}${GOOGLE_API_PATH_NEW}?${requestQuery}`
  }

  this.executeRequest('post', options, (error, body) => {
    if (error) return callback(error)

    callback(null, body.access_token)
  })
}

function checkParam(param) {
  if (param === undefined) return ''
  else if (isValidType(param)) return param
  else if (isValidType(param['$t'])) return param['$t']
  else return param
}

function isValidType(value) {
  return typeof value === 'string' || typeof value === 'number'
}


function getVideos(accessToken, options, callback) {
  const accessTokenParams = {
    alt: FETCH_AS_JSON,
    kind: 'photo',
    access_token: accessToken
  }

  options = options || {}

  if (options.maxResults) accessTokenParams['max-results'] = options.maxResults

  const albumPart = options.albumId ? `/albumid/${options.albumId}` : ''

  const requestQuery = querystring.stringify(accessTokenParams)

  const requestOptions = {
    url: `${PICASA_SCOPE}${PICASA_API_FEED_PATH}${albumPart}?${requestQuery}`,
    headers: {
      'GData-Version': '2'
    }
  }

  this.executeRequest('get', requestOptions, (error, body) => {
    if (error) return callback(error)

    const photos = body.feed.entry.map(
      entry => {
        try {
          var defaultEntry = parseEntry(entry, videoSchema);
          defaultEntry["ts"] = new Date(parseInt(entry.gphoto$timestamp.$t));
          defaultEntry["sources"] = entry.media$group.media$content.filter(f => f.medium === "video");
          defaultEntry["thumbnail"] = entry.media$group.media$thumbnail;
          defaultEntry["orgResolutionPresent"] = true;
          var defaultSource = entry.media$group.media$content.find(f => f.medium === "video" && f.height.toString() === defaultEntry.height);
          defaultEntry.content.thumb = defaultEntry.content.src;
          if (defaultSource == null) {
            defaultEntry["orgResolutionPresent"] = false;
            defaultSource = entry.media$group.media$content.filter(f => f.medium === "video").sort(function (a, b) {
              if (a.width < b.width)
                return -1;
              if (a.width > b.width)
                return 1;
              return 0;
            }).pop();
          }
          defaultEntry.content.src = defaultSource.url;
          defaultEntry.content.type = defaultSource.type;
          return defaultEntry;
        } catch (error) {
          console.log('An error occurred while parsing the video entry.' + error);
        }
      }
    ).filter(x => x);
    callback(null, photos)
  })
}

async function createResumableVideo(accessToken, albumId, videoData) {

  var pathToAlbum = 'https://photos.googleapis.com/data/upload/resumable/media/create-session/feed/api/user/default/albumid/' + albumId;
  var videoCreateBody = `<?xml version="1.0" encoding="UTF-8"?>
                      <entry xmlns="http://www.w3.org/2005/Atom" xmlns:gphoto="http://schemas.google.com/photos/2007">
                        <category scheme="http://schemas.google.com/g/2005#kind" term="http://schemas.google.com/photos/2007#photo"/>
                        <title>${videoData.title}</title>
                        <summary>${videoData.summary}</summary>
                        <gphoto:timestamp>${new Date().getTime()}</gphoto:timestamp>
                      </entry>`;

  var photoCreateResponse = await axios.post(pathToAlbum, videoCreateBody, {
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'X-Upload-Content-Length': videoData.contentLength,
      'X-Upload-Content-Type': videoData.mimeType,
      'Slug': videoData.title,
      'X-Forwarded-By': 'me',
      'data-binary': '@-',
      'GData-Version': '3'
    }
  });
  return {
    photoLocation: photoCreateResponse.headers.location
  };
}

async function uploadDriveFileToPhoto(options) {
  got.stream(`https://www.googleapis.com/drive/v3/files/${options.fileId}?alt=media`, {
    encoding: null,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Range': `bytes = ${rangeStart}-${rangeStart + fileSizeToUpload - 1}`
    }
  }).on('response', function (response) {
    //check for error response??
    var videoData = {
      body: response,
      rangeStart: 0,
      fileSizeToUpload: 1000,
      totalSize: 1000,
      title: `title`,
      summary: `GP_${options.fileId}`
    };
    postVideo('accesstoken', '1222929', videoData, () => {

    });
  })

}

async function postVideo(accessToken, albumId, videoData, progressCb) {
  var photoCreateRes = await createResumableVideo(accessToken, albumId, videoData);
  return resumeUpload(photoCreateRes.photoLocation, videoData, progressCb);
}

async function resumeUpload(photoLocation, videoData, progressCb) {
  return new Promise((resolve, reject) => {
    //double check the logic
    var fileSizeToUpload = videoData.range ? videoData.range.end : videoData.contentLength, rangeStart = videoData.range ? videoData.range.start : 0, totalSize = videoData.contentLength;
    // var interval;
    var bytesReceived = 0;
    videoData.body
      .on('data', function (chunk) {
        bytesReceived += chunk.length;
      })
      .pipe(got.stream(photoLocation, {
        method: "PUT",
        headers: {
          'Content-Length': fileSizeToUpload,
          'Content-Range': `bytes ${rangeStart}-${rangeStart + fileSizeToUpload - 1}/${totalSize}`,
          'Expect': ''
        }
      })
      .on('uploadProgress',(progress)=>{
        progressCb(progress);
      })
      // .on('request', function (uploadRequest) {
      //   console.log('Upload request initiated...');
      //   progressCb({ status: 'Upload request initiated', statusCode: 1 });
      //   var initRequestBytesWritten = uploadRequest.connection.bytesWritten;
      //   interval = setInterval(function () {
      //     var actualDataBytesWritten = (uploadRequest.connection.bytesWritten - initRequestBytesWritten);
      //     progressCb({ status: 'Uploading', bytesReceived: bytesReceived, statusCode: 2, bytesWritten: actualDataBytesWritten, timestamp: new Date() });
      //   }, 500);
      // })
      .on('response', function (whateverresponse) {
        //progressCb({ status: 'Upload completed.', statusCode: 4, timestamp: new Date() }); 
        console.log('Upload request response recvd.'); console.log('Status Code: ' + whateverresponse.statusCode); resolve({ status: 'OK' });
        //clearInterval(interval);
      })
      .on('error', function (requestUploadErr) {
        console.log('error occurred while uploading file.. ' + JSON.stringify(requestUploadErr));
        if (requestUploadErr.statusCode === 308) {
          console.log('continuing as code is 308');
          //progressCb({ status: 'Upload completed.', statusCode: 5, timestamp: new Date() });
          resolve({ status: 'OK' });
        }
        else {
          //progressCb({ status: 'Upload error.', statusCode: 3, timestamp: new Date() });
          reject({ error: 'An error occurred: ', errorObject: requestUploadErr });
        }
        //  clearInterval(interval);
      }));
  });
}

module.exports = Picasa
