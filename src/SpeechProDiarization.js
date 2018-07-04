'use strict';

const diarization_default_options = {
  "host": "https://cp.speechpro.com/vkdiarization/rest/",
  "bufferSize": 2048,
  "numChannels": 1,
  "sampleRate": 16000,
}

class SpeechProDiarization {
  constructor(options) {
    this.options = options || {};
    this.options.host = options.host || diarization_default_options.host;

    this.session_id = null;
    let self = this;

    self.createSession(self.options.client).then(function(data) {

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

  diarization(file) {
    let self = this;
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function(e) {
      self.ajax('POST', self.options.host + 'v1/diarization', true, {
        "audio": {
          "data": e.target.result.split(',')[1],
          "mime": "audio/s16be"
        }
      }, {
        "Content-type": "application/json;charset=UTF-8",
        "X-Session-Id": self.session_id
      }).then(function(data) {
        try {
          self.diarizationComplete(data);
        } catch (e) {}
      }).catch(function(e) {
        try {
          self.diarizationError(e);
        } catch (e) {}
      });
    }
  }

  recorder() {
    let self = this;

    return new Promise(function(initComplete, initFail) {
      self.options.bufferSize = diarization_default_options.bufferSize;
      self.options.numChannels = diarization_default_options.numChannels;
      self.options.sampleRate = diarization_default_options.sampleRate;

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

  startRecord() {
    let self = this;

    if (self.isRecording()) {
      console.warn("startRecording: previous recording is running");
    } else if (!self.options.recorder) {
      console.warn("startRecording: recorder is not initialized");
    } else {

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

    if (this.isRecording()) {
      this.volume.disconnect();
      this.processor.disconnect();
      delete this.processor;
      this.encodeWav();
    } else {
      console.warn("finishRecording: no recording is running");
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
      console.warn("downsampling rate show be smaller than original sample rate");
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

    this.diarization(new Blob([view], {
      type: 'audio/x-wav'
    }));
  }
}