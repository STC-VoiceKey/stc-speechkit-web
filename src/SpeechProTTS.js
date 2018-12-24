'use strict';

const tts_default_options = {
  "host": "https://cp.speechpro.com/vktts/rest/",
  "voice": "Alexander",
  "language": "Russian",
  "numChannels": 1,
  "sampleRate": 22050
}

class SpeechProTTS {

  constructor(options) {
    this.options = {
      "host": options.host || tts_default_options.host,
      "voice": options.voice || tts_default_options.voice,
      "language": options.language || tts_default_options.language
    };

    let self = this;

    if (options.client && typeof options.client === 'object') {
      self.createSession(options.client).then(function(data) {
        self.session_id = data.session_id;
        try {
          self.complete(self.session_id);
        } catch (e) {}
      }).catch(function(e) {
        try {
          self.error(e);
        } catch (e) {}
      });
    }

  }

  ajax(method, url, async, data, headers) {
    return new Promise(function(resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url, async);

      if (typeof headers == 'object') {
        for (let key in headers) {
          xhr.setRequestHeader(key, headers[key]);
        }
      }

      xhr.onreadystatechange = function() {
        if (this.readyState == 4) {
          if (this.status == 200) {
            try {
              resolve(JSON.parse(this.responseText));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(this);
          }
        }
      };

      xhr.send(JSON.stringify(data));
    });
  }

  createSession(data) {
    return this.ajax('POST', this.options.host + 'session', true, data, {
      "Content-type": "application/json;charset=UTF-8"
    });
  }

  checkSession() {
    return this.ajax('GET', this.options.host + 'session', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  closeSession() {
    return this.ajax('DELETE', this.options.host + 'session', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  getLanguages() {
    return this.ajax('GET', this.options.host + 'v1/languages', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  setLanguage(language) {
    this.options.language = language;
  }

  setVoice(voice) {
    this.options.voice = voice;
  }

  getVoices(language) {
    return this.ajax('GET', this.options.host + 'v1/languages/' + (language || this.options.language) + '/voices', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  getSocket(data) {
    return this.ajax('POST', this.options.host + 'v1/synthesize/stream', true, data, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  closeSocket() {
    return this.ajax('DELETE', this.options.host + 'v1/synthesize/stream', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id,
      "X-Transaction-Id": this.transaction_id
    });
  }

  createSocket(voice) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.getSocket({
        "text": {
          "mime": "text/plain"
        },
        "voice_name": voice || self.options.voice,
        "audio": "audio/wav"
      }).then(function(data) {
        let socket = new WebSocket(data.url);
        self.transaction_id = data.url.split("stream/")[1];
        resolve(socket);
      }).catch(function(e) {
        reject(e);
      });
    });
  }

  sendSocket(text, options) {
    let self = this;

    if (!self.socket) {
      self.createSocket(options.voice).then(function(socket) {

        self.socket = socket;
        self.socket.binaryType = 'arraybuffer';
        self.int16Array = new Int16Array();

        self.socket.onopen = function() {
          console.log("Socket: connection success");
          self.socket.send(text);
        };

        self.socket.onclose = function(event) {
          if (event.wasClean) {
            console.log("Socket: connection closed cleanly");

            let blob = self.encodeWav(self.int16Array);
            let blobUrl = URL.createObjectURL(blob);
            if (options.play) {
              let audio = new Audio(blobUrl);
              audio.play();
            }

            try {
              self.synthesizeSocketComplete({
                "blob": blob,
                "blobUrl": blobUrl
              });
            } catch (e) {}

          } else {
            console.log("Socket: disconnect");
          }
          console.log('Code: ' + event.code + ' reason: ' + event.reason);
          self.socket = null;
          self.int16Array = null;
        };

        self.socket.onmessage = function(event) {

          let data = new Int16Array(event.data);
          self.int16Array = self.appendBuffer(self.int16Array, data);

          try {
            self.synthesizeSocketOnline(event.data);
          } catch (e) {}

        };

        self.socket.onerror = function(error) {
          console.log("Socket: error: " + error.message);
        };

      }).catch(function(e) {
        console.error(e);
      });
    } else {
      self.socket.send(text);
    }


  }

  getWavFromBuffer() {
    return this.int16Array ? this.encodeWav(this.int16Array) : null;
  }

  synthesize(text, options) {
    let self = this,
    voice, play;
    
    text = text || '';
    
    if (options && typeof options === 'object') {
      voice = options.voice;
      play = options.play;
    } 

    self.ajax('POST', self.options.host + 'v1/synthesize', true, {
      "text": {
        "mime": "text/plain",
        "value": text
      },
      "voice_name": voice || self.options.voice,
      "audio": "audio/wav"
    }, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": self.session_id
    }).then(function(result) {

      let blob = self.b64ToBlob(result.data);
      let blobUrl = URL.createObjectURL(blob);
      if (play) {
        let audio = new Audio();
        audio.src = blobUrl;
        audio.play();
      }
      try {
        self.synthesizeComplete({
          "b64Data": result.data,
          "blob": blob,
          "blobUrl": blobUrl
        });
      } catch (e) {}
    }).catch(function(e) {
      try {
        self.synthesizeError(e);
      } catch (e) {}
    });

  }

  writeUTFBytes(view, offset, string) {
    let lng = string.length;
    for (let i = 0; i < lng; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  appendBuffer(buffer1, buffer2) {
    let tmp = new Int16Array(buffer1.byteLength / 2 + buffer2.byteLength / 2);
    tmp.set(new Int16Array(buffer1), 0);
    tmp.set(new Int16Array(buffer2), buffer1.byteLength / 2);
    return tmp;
  };

  encodeWav(int16Array) {
    let buffer = new ArrayBuffer(44 + int16Array.length * 2);
    let view = new DataView(buffer);
    this.writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + int16Array.length * 2, true);
    this.writeUTFBytes(view, 8, 'WAVE');
    this.writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, tts_default_options.numChannels, true);
    view.setUint32(24, tts_default_options.sampleRate, true);
    view.setUint32(28, tts_default_options.sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    this.writeUTFBytes(view, 36, 'data');
    view.setUint32(40, int16Array.length * 2, true);


    let lng = int16Array.length,
      index = 44,
      volume = 1;

    for (let i = 0; i < lng; i++) {
      view.setInt16(index, int16Array[i] * volume, true);
      index += 2;
    }

    return new Blob([view], {
      type: 'audio/x-wav'
    })
  }

  b64ToBlob(b64Data, contentType, sliceSize) {

    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    let byteCharacters = atob(b64Data),
      byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      let slice = byteCharacters.slice(offset, offset + sliceSize);

      let byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      let byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    let blob = new Blob(byteArrays, {
      type: contentType
    });

    return blob;
  }

}