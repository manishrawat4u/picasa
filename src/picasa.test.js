'use strict'

const chai   = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const expect = chai.expect
chai.use(sinonChai)

const Picasa = require('./picasa')

describe('Picasa', () => {
  let picasa
  let stub

  beforeEach(() => {
    const clientId = 'apps.google.com'
    const redirectURL = 'http://localhost'
    const clientSecret = 'client_secretABC'

    picasa = new Picasa(clientId, redirectURL, clientSecret)
  })

  describe('getPhotos', () => {
    describe('on status code different than 200', () => {
      describe('on error 403', () => {
        beforeEach(() => {
          const body = 'weird error'
          const response = { statusCode : 403 }

          stub = sinon.stub(picasa.request, 'get')
          stub.callsArgWithAsync(1, null, response, body)
        })

        afterEach(() => stub.restore())

        it('should return an error from the body', () => {
          picasa.getPhotos('notValid', (error, photos) => {
            expect(error.message).to.be.equals('weird error')
            expect(photos).to.be.equals(null)

            done()
          })
        })
      })
    })

    describe('on success', () => {
      beforeEach(() => {
        const body = {
          "feed":{
            "entry":[
              {
                "id":{
                  "$t":"https://picasaweb.google.com/data/entry/user/11111/albumid/1111/photoid/11111"
                },
                "published":{
                  "$t":"2015-11-28T07:13:31.000Z"
                },
                "updated":{
                  "$t":"2015-11-28T07:22:35.478Z"
                },
                "app$edited":{
                  "$t":"2015-11-28T07:22:35.478Z"
                },
                "title":{
                  "$t":"IMG_0327.JPG"
                },
                "summary":{
                  "$t":""
                },
                "content":{
                  "type":"image/jpeg",
                  "src":"https://lh3.googleusercontent.com/-1111111/1111/11111/1111/IMG_0327.JPG"
                }
              }
            ]
          }
        }

        const response = { statusCode : 200 }

        stub = sinon.stub(picasa.request, 'get')
        stub.callsArgWithAsync(1, null, response, JSON.stringify(body))
      })

      afterEach(() => stub.restore())

      it('returns an array of photos', (done) => {
        const accessToken = 'ya29.OwJqqa1Y2tivkkCWWvA8vt5ltKsdf9cDQ5IRNrTbIt-mcfr5xNj4dQu41K6hZa7lX9O-gw'

        picasa.getPhotos(accessToken, (error, photos) => {
          expect(error).to.be.equals(null)

          expect(photos[0].src).to.contain('IMG_0327.JPG')
          expect(photos[0].type).to.be.equals('image/jpeg')

          const requestOptions = stub.firstCall.args[0]

          expect(requestOptions.url).to.be.equals(`https://picasaweb.google.com/data/feed/api/user/default?max-results=1&alt=json&kind=photo&access_token=${accessToken}`)
          expect(requestOptions.headers).to.deep.equal({ 'GData-Version': '2' })

          done()
        })
      })
    })
  })

  describe('getAuthURL', () => {
    it('returns valid URI', () => {
      expect(picasa.getAuthURL())
        .to.be.equals('https://accounts.google.com/o/oauth2/auth?access_type=offline&scope=https%3A%2F%2Fpicasaweb.google.com%2Fdata%2F&response_type=code&client_id=apps.google.com&redirect_uri=http%3A%2F%2Flocalhost')
    })
  })

  describe('getAccessToken', () => {
    beforeEach(() => {
      const body = {
        access_token : 'ya29.KwLDeXsw1jNAavZ8jEMFgikhDg_CnUX1oMr5RQUyeqTBf229YV4HzhhXvRgBBvFGqTqxdw',
        token_type   : 'Bearer',
        expires_in   : 3580
      }

      stub = sinon.stub(picasa.request, 'post')
      stub.callsArgWithAsync(1, null, {}, body)
    })

    afterEach(() => stub.restore())

    it('returns access token response', (done) => {
      picasa.getAccessToken('4/DxoCTw8Rf3tQAAW94h6lK7ioEjnu6K8kEqVZ0d-cRA8', (error, accessToken) => {
        expect(error).to.be.equal(null)
        expect(accessToken).to.be.equals('ya29.KwLDeXsw1jNAavZ8jEMFgikhDg_CnUX1oMr5RQUyeqTBf229YV4HzhhXvRgBBvFGqTqxdw')

        expect(stub).to.have.been.calledWith('https://www.googleapis.com/oauth2/v3/token?grant_type=authorization_code&code=4%2FDxoCTw8Rf3tQAAW94h6lK7ioEjnu6K8kEqVZ0d-cRA8&redirect_uri=http%3A%2F%2Flocalhost&client_id=apps.google.com&client_secret=client_secretABC')

        done()
      })
    })
  })
})