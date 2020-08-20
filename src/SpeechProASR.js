'use strict';

const asr_default_options = {
  "host": "https://cp.speechpro.com/vkasr/rest/",
  "package": "FarField",
  "packageSocket": "FarField",
  "bufferSize": 2048,
  "bufferLength": 60000,
  "numChannels": 1,
  "sampleRate": 16000,
  "sampleRateSocket": 16000
}

class SpeechProASR {
  constructor(options) {
    this.options = {
      "host": options.host || asr_default_options.host,
      "package": options.package || asr_default_options.package,
      "packageSocket": options.packageSocket || asr_default_options.packageSocket,
      "bufferLength": options.bufferLength || asr_default_options.bufferLength,
      "recorder": options.recorder || false
    };

    this.session_id = null;

    let self = this;

    if (options.client && typeof options.client === 'object') {
      self.createSession(options.client).then(function(data) {

        if (self.options.recorder) {
          self.recorder();
        }

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

  getPackages() {
    return this.ajax('GET', this.options.host + 'v1/packages/available', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  setPackage(packageId) {
    this.options.package = packageId;
  }

  setPackageSocket(packageId) {
    this.options.packageSocket = packageId;
  }

  packageLoad(packageId) {
    return this.ajax('GET', this.options.host + 'v1/packages/' + packageId + '/load', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  packageUnload(packageId) {
    return this.ajax('GET', this.options.host + 'v1/packages/' + packageId + '/unload', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  recognizeFile(file) {
    let self = this;
    self.packageLoad(self.options.package).then(function() {
      self.recognize(file);
    }).catch(function(e) {
      console.error(e.responseText);
    });
  }

  recognize(file) {
    let self = this;
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function(e) {
      self.ajax('POST', self.options.host + 'v1/recognize', true, {
        "audio": {
          "data": e.target.result.split(',')[1],
          "mime": "audio/x-wav"
        },
        "package_id": self.options.package
      }, {
        "Content-type": "application/json;charset=UTF-8",
        "X-Session-Id": self.session_id
      }).then(function(data) {
        try {
          self.recognizeComplete(data);
        } catch (e) {}
      }).catch(function(e) {
        try {
          self.recognizeError(e);
        } catch (e) {}
      }).finally(function() {
        self.packageUnload(self.options.package).then(function() {
          self.packageLoaded = null;
        });
      });
    }
  }

  getSocket(data) {
    return this.ajax('POST', this.options.host + 'v1/recognize/stream', true, data, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id
    });
  }

  closeSocket() {
    return this.ajax('DELETE', this.options.host + 'v1/recognize/stream', true, null, {
      "Content-type": "application/json;charset=UTF-8",
      "X-Session-Id": this.session_id,
      "X-Transaction-Id": this.transaction_id
    });
  }

  createSocket() {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.getSocket({
        "package_id": self.options.packageSocket,
        "mime": "audio/l16"
      }).then(function(data) {
        let socket = new WebSocket(data.url);
        self.transaction_id = data.url.split("stream/")[1];
        resolve(socket);
      }).catch(function(e) {
        reject(e);
      });
    });
  }

  recorder() {
    let self = this;

    return new Promise(function(initComplete, initFail) {
      self.options.bufferSize = asr_default_options.bufferSize;
      self.options.numChannels = asr_default_options.numChannels;
      self.options.sampleRate = asr_default_options.sampleRate;
      self.options.sampleRateSocket = asr_default_options.sampleRateSocket;
      window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;


      self.getUserMedia = navigator.getUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia ||
        navigator.webkitGetUserMedia;

      self.mediaDevices = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ?
        navigator.mediaDevices : (self.getUserMedia ? {
          getUserMedia: function(o) {
            return new Promise(function(resolve, reject) {
              self.getUserMedia.call(navigator, o, resolve, reject);
            });
          }
        } : null);

      self.mediaDevices.getUserMedia({
        "audio": true
      }).then(function(stream) {

        let AudioContext = window.AudioContext || window.webkitAudioContext;
        self.context = new AudioContext();
        self.source = self.context.createMediaStreamSource(stream);
        self.sampleRate = self.context.sampleRate;

        if (self.context.createScriptProcessor == null) {
          self.context.createScriptProcessor = self.context.createJavaScriptNode;
        }

        self.volume = self.context.createGain();
        self.source.connect(self.volume);
        self.options.recorder = true;
        initComplete(stream);
      }).catch(function(e) {
        initFail(e);
      });
    });
  }

  startSocket() {


      let self = this;

      this.createSocket().then(function(socket) {
        self.socket = socket;

        self.socket.onopen = function() {

          console.log("Socket: connection success");

          let leftchannel = [];
          let rightchannel = [];
          let recordingLength = 0;

          self.processor = self.context.createScriptProcessor(self.options.bufferSize, 2, 2);

          self.processor.onaudioprocess = function(e) {

            let left = e.inputBuffer.getChannelData(0);
            let right = e.inputBuffer.getChannelData(1);

            leftchannel.push(new Float32Array(left));
            rightchannel.push(new Float32Array(right));
            recordingLength += self.options.bufferSize;

            self.lastRecording = {
              "left": leftchannel,
              "right": rightchannel,
              "length": recordingLength
            }

            if (recordingLength > self.options.bufferLength) {

              self.sendSocket(leftchannel, rightchannel, recordingLength);
              leftchannel = [];
              rightchannel = [];
              recordingLength = 0;
              self.lastRecording = null;
            }
          }

          self.volume.connect(self.processor);
          self.processor.connect(self.context.destination);
        };

        self.socket.onclose = function(event) {

          self.recSocket = null;

          if (event.wasClean) {
            console.log("Socket: connection closed cleanly");
          } else {
            console.log("Socket: disconnect");
          }
          console.log('Code: ' + event.code + ' reason: ' + event.reason);

        };

        self.socket.onmessage = function(event) {
          try {
            self.recognizeSocketComplete(event.data);
          } catch (e) {}
        };

        self.socket.onerror = function(error) {

          self.recSocket = null;

          console.log("Socket: error: " + error.message);

        };


      }).catch(function(e) {

        self.recSocket = null;

        console.error("Socket: create socket fail: " + e.responseText);

      });
  }

  sendSocket(leftchannel, rightchannel, recordingLength) {

    let self = this;

    let leftBuffer = this.mergeBuffers(leftchannel, recordingLength);
    let rightBuffer = this.mergeBuffers(rightchannel, recordingLength);

    leftBuffer = this.downSampleBuffer(leftBuffer, this.options.sampleRateSocket);
    rightBuffer = this.downSampleBuffer(rightBuffer, this.options.sampleRateSocket);

    let interleaved = this.options.numChannels > 1 ? this.interleave(leftBuffer, rightBuffer) : leftBuffer;

    let buffer = new ArrayBuffer(44 + interleaved.length * 2);
    let view = new DataView(buffer);

    let index = 44;

    for (let i = 0; i < interleaved.length; i++) {
      view.setInt16(index, interleaved[i] * (0x7FFF * 1), true);
      index += 2;
    }

    let req = function() {
      if (self.packageSocketLoaded) {
        self.socket.send(new Blob([view], {
          type: 'audio/l16'
        }));
      } else {
        requestAnimationFrame(req);
      }
    }

    requestAnimationFrame(req);
  }

  startRecord() {
    let self = this;

    if (self.isRecording()) {
      console.info("startRecording: previous recording is running");
    } else if (!self.options.recorder) {
      console.info("startRecording: recorder is not initialized");
    } else {

      self.packageLoad(self.options.package).then(function() {
        self.packageLoaded = true;
      }).catch(function(e) {
        console.error(e.responseText);
      });


      self.leftchannel = [];
      self.rightchannel = [];
      self.recordingLength = 0;

      self.processor = self.context.createScriptProcessor(self.options.bufferSize, 2, 2);

      self.processor.onaudioprocess = function(e) {
        let left = e.inputBuffer.getChannelData(0);
        let right = e.inputBuffer.getChannelData(1);

        self.leftchannel.push(new Float32Array(left));
        self.rightchannel.push(new Float32Array(right));
        self.recordingLength += self.options.bufferSize;
      }

      self.volume.connect(self.processor);
      self.processor.connect(self.context.destination);
    }
  }

  stopRecord() {

    if (this.isRecording() && !this.recSocket) {

      this.volume.disconnect();
      this.processor.disconnect();
      delete this.processor;
      this.encodeWav();
    } else {
      console.info("finishRecording: no recording is running");
    }
  }

  startRecordSocket() {
    let self = this;

    if (self.isRecording() || self.recSocket) {
      console.info("startRecordingSocket: previous recording is running");
    } else {

      self.recSocket = true;

      self.packageLoad(self.options.packageSocket).then(function() {
        self.packageSocketLoaded = true;
      }).catch(function(e) {
        console.error(e.responseText);
      });


      if (!self.options.recorder) {

        this.recorder().then(function() {
          self.startSocket();
        }).catch(function(e) {
          console.error(e);
        });
      } else {
        self.startSocket();
      }
    }
  }

  stopRecordSocket() {
    let self = this;

    if (self.isRecording() && self.recSocket) {

      self.recSocket = null;

      self.sendSocket(self.lastRecording.left, self.lastRecording.right, self.lastRecording.length);
      self.volume.disconnect();
      self.processor.disconnect();
      delete self.processor;
      self.closeSocket().then(function(data) {
        try {
          self.recognizeSocketCompleteFinal(data);
        } catch (e) {}
      }).catch(function() {
        self.socket.close();
      }).finally(function() {
        self.packageUnload(self.options.packageSocket).then(function() {
          self.packageSocketLoaded = null;
        });
      });

    } else {
      console.info("finishRecordingSocket: no recording is running");
    }
  }

  isRecording() {
    return this.processor != null;
  }

  mergeBuffers(channelBuffer, recordingLength) {
    let result = new Float32Array(recordingLength);
    let offset = 0;
    let lng = channelBuffer.length;
    for (let i = 0; i < lng; i++) {
      let buffer = channelBuffer[i];
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  interleave(leftChannel, rightChannel) {
    let length = leftChannel.length + rightChannel.length;
    let result = new Float32Array(length);
    let inputIndex = 0;

    for (let index = 0; index < length;) {
      result[index++] = leftChannel[inputIndex];
      result[index++] = rightChannel[inputIndex];
      inputIndex++;
    }
    return result;
  }

  writeUTFBytes(view, offset, string) {
    let lng = string.length;
    for (let i = 0; i < lng; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  downSampleBuffer(buffer, rate) {
    if (rate == this.sampleRate) {
      return buffer;
    }
    if (rate > this.sampleRate) {
      console.info("downsampling rate show be smaller than original sample rate");
    }
    let sampleRateRatio = this.sampleRate / rate;
    let newLength = Math.round(buffer.length / sampleRateRatio);
    let result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0,
        count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  encodeWav() {

    let leftBuffer = this.mergeBuffers(this.leftchannel, this.recordingLength);
    let rightBuffer = this.mergeBuffers(this.rightchannel, this.recordingLength);

    leftBuffer = this.downSampleBuffer(leftBuffer, this.options.sampleRate);
    rightBuffer = this.downSampleBuffer(rightBuffer, this.options.sampleRate);

    let interleaved = this.options.numChannels > 1 ? this.interleave(leftBuffer, rightBuffer) : leftBuffer;

    let buffer = new ArrayBuffer(44 + interleaved.length * 2);
    let view = new DataView(buffer);

    this.writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 44 + interleaved.length * 2, true);
    this.writeUTFBytes(view, 8, 'WAVE');
    this.writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, this.options.numChannels, true);
    view.setUint32(24, this.options.sampleRate, true);
    view.setUint32(28, this.options.sampleRate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    this.writeUTFBytes(view, 36, 'data');
    view.setUint32(40, interleaved.length * 2, true);


    let lng = interleaved.length,
      index = 44,
      volume = 1;

    for (let i = 0; i < lng; i++) {
      view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
      index += 2;
    }

    let self = this;

    let req = function() {
      if (self.packageLoaded) {
        self.recognize(new Blob([view], {
          type: 'audio/x-wav'
        }));
      } else {
        requestAnimationFrame(req);
      }
    }

    requestAnimationFrame(req);
  }
}