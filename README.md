# STC speech libraries for web
Libraries for the use of rest API recognition, synthesis and speech diarization
#### ASR
`rest API` https://cp.speechpro.com/vkasr/rest/ \
`help` https://cp.speechpro.com/vkasr/help
#### TTS
`rest API` https://cp.speechpro.com/vktts/rest/ \
`help` https://cp.speechpro.com/vktts/help
#### Diarization
`rest API` https://cp.speechpro.com/vkdiarization/rest/ \
`help` https://cp.speechpro.com/vkdiarization/help

## Using library ASR
Load main script from HTML first.

```html
<script src="SpeechProASR.js"></script>
```
### Constructor
```javascript
asr = new SpeechProASR(config);
```
* config (Parameters with default values are not required)
    * `client`: user data for authorization
        * `.username`: "username"
        * `.password`: "password"
        * `.domain_id`: "id"
    * `recorder`: record audio input and encodes to audio file image (Blob object). After the end of the recording, it sends the data to the server for recognition (default = `false`)
    * `bufferLength`: The size of the buffer sent to the server (only WebSockets)
    * `package`: package name for using recognize (default = `"FarField"`)
    * `packageSocket`: package name for using online recognize (WebSockets) (default = `"FarField"`)

### Methods
```javascript
asr.getPackages();
```
Get all available packages

* Parameters
    * (none)
* Returns (Promise `then` or `catch`)
    * `Array`: array of objects with data about available packages
```javascript
asr.setPackage(packageId);
```
Set package after initialization

* Parameters
    * `.packageId`: package identifier (type: 'String')
* Returns
    * (none)
```javascript
asr.setPackageSocket(packageId);
```
Set package for WebSockets after initialization

* Parameters
    * `.packageId`: package identifier (type: 'String')
* Returns
    * (none)

```javascript
asr.recognizeFile(file);
```
Recognize from wav file
* Note
  * **_The file must have a sampling frequency of 16000_**
* Parameters
    * `.file`: blob object (type: 'audio/wav')
* Returns
    * (none)

```javascript
asr.startRecord();
```
Start recording from microphone (Can be used if the parameter `recorder` = `true`)
* Parameters
    * (none)
* Returns
    * (none)
```javascript
asr.stopRecord();
```
Stop recording and send audio to server (Can be used if the parameter `recorder` = `true`)
* Parameters
    * (none)
* Returns
    * (none)
```javascript
asr.startRecordSocket();
```
Start recording and send audio to server on WebSockets (automatically used recorder)
* Parameters
    * (none)
* Returns
    * (none)
```javascript
asr.stopRecordSocket();
```
Stop recording and close WebSockets
* Parameters
    * (none)
* Returns
    * (none)

### Events

`complete` - asr object has been initialized \
`recognizeComplete` - Recognition result \
`recognizeSocketComplete` - Recognition result web sockets \
`recognizeSocketCompleteFinal` - The final result of recognition web sockets (Returns the result after the socket is closed)\
`recognizeError` - Recognition error

### Examples
```javascript
let asr = new SpeechProASR({
  "client": {
    "username": "username",
    "password": "password",
    "domain_id": "id"
  },
  "recorder": true, //default false
});

asr.complete = function(){
  //  asr object initialized, here you can use the available methods

  //  Events

  asr.recognizeComplete = function(result){
    //  result = {
    //    "score": recognize score,
    //    "text": recognized text,
    //  }
  }

  asr.recognizeError = function(error){
    //  recognize error
  }

  asr.recognizeSocketComplete = function(result){
    //  result = recognized text

  }

  asr.recognizeSocketCompleteFinal = function(result){
    //  result = {
    //    "score": recognize score,
    //    "text": recognized text,
    //  }
  }
}
```

## Using library TTS
Load main script from HTML first.

```html
<script src="SpeechProTTS.js"></script>
```
### Constructor
```javascript
tts = new SpeechProTTS(config);
```
* config (Parameters with default values are not required)
    * `client`: user data for authorization
        * `.username`: "username"
        * `.password`: "password"
        * `.domain_id`: "id"
### Methods

```javascript
tts.getLanguages();
```
Get all available languages

* Parameters
    * (none)
* Returns (Promise `then` or `catch`)
    * `Array`: array of objects with data about available languages
```javascript
tts.getVoices(language);
```
Get all available voices

* Parameters
    * `language`: 'language name' (default = 'Russian')
* Returns (Promise `then` or `catch`)
    * `Array`: array of objects with data about available voices
```javascript
tts.setLanguage(language);
```
Set language after initialization

* Parameters
    * `.language`: language identifier (type: 'String')
* Returns
    * (none)
```javascript
tts.setVoice(voice);
```
Set voice after initialization

* Parameters
    * `.voice`: voice identifier (type: 'String')
* Returns
    * (none)
```javascript
tts.synthesize(text, options);
```
Text synthesis

* Parameters
    * `text`: "your text"
    * `options`:
        * `.voice`: "voice_name" (default = 'Alexander')
        * `.play`: Synthesized text playing (default = 'false')
* Returns
    * (none)
```javascript
tts.sendSocket(text, options);
```
Text synthesis for WebSockets

* Parameters
    * `text`: "your text"
    * `options`:
        * `.voice`: "voice_name" (default = 'Alexander')
        * `.play`: Synthesized text playing after socket closed (default = 'false')
* Returns
    * (none)
```javascript
tts.getWavFromBuffer();
```
Returns the wav file from the accumulated socket message buffer. If the socket is closed, returns `null`

* Parameters
    * (none)
* Returns
    * `blob`: object Blob (type = 'audio/wav')

## Events
`complete` - tts object has been initialized \
`synthesizeComplete` - Synthesis result \
`synthesizeSocketComplete` - Synthesis result WebSockets \
`synthesizeError` - Synthesis error \
`synthesizeSocketOnline` - Intermediate synthesis result (socket messages, type: 'ArrayBuffer')
## Examples
```javascript
let tts = new SpeechProTTS({
  "client": {
    "username": "username",
    "password": "password",
    "domain_id": "id"
  }
});

tts.complete = function() {
  //  tts object initialized, here you can use the available methods

  // Events
  tts.synthesizeComplete = function(result) {
    //  result = {
    //    "b64Data": base64 data,
    //    "blob": object blob (type = 'audio/wav'),
    //    "blobUrl": blobUrl (object URL.createObjectURL)
    //  }
  }

  tts.synthesizeError = function(error) {
    // Synthesis error
  }

  tts.synthesizeSocketComplete = function(result) {
    //  result = {
    //    "blob": object blob (type = 'audio/wav'),
    //    "blobUrl": blobUrl (object URL.createObjectURL)
    //  }
  }

  tts.synthesizeSocketOnline = function(arraybuffer) {
    //  result socket message
  }
}
```
## Using library Diarization
Load main script from HTML first.

```html
<script src="SpeechProDiarization.js"></script>
```
### Constructor
```javascript
diariz = new SpeechProDiarization(config);
```
* config (Parameters with default values are not required)
    * `client`: user data for authorization
        * `.username`: "username"
        * `.password`: "password"
        * `.domain_id`: "id"
    * `recorder`: record audio input and encodes to audio file image (Blob object). After the end of the recording, it sends the data to the server for diarization (default = `false`)

### Methods

```javascript
diariz.diarization(file);
```
Diarization from wav file

* Parameters
    * `.file`: blob object (type: 'audio/wav')
* Returns
    * (none)

```javascript
diariz.startRecord();
```
Start recording from microphone (Can be used if the parameter `recorder` = `true`)
* Parameters
    * (none)
* Returns
    * (none)
```javascript
diariz.stopRecord();
```
Stop recording and send audio to server (Can be used if the parameter `recorder` = `true`)
* Parameters
    * (none)
* Returns
    * (none)

### Events

`complete` - diarization object has been initialized \
`diarizationComplete` - Diarization result \
`diarizationError` - Diarization error


### Examples
```javascript
let diariz = new SpeechProDiarization({
  "client": {
    "username": "username",
    "password": "password",
    "domain_id": "id"
  },
  "recorder": true, //default false
});

diariz.complete = function(){
  //  diarization object initialized, here you can use the available methods

  //  Events
  diariz.diarizationComplete = function(result){
    //  result = {
    //    "data": {
    //      "speakers": [{
    //        "number": 0,
    //        "segments": [{
    //          "start": 0,
    //          "length": 0
    //        }]
    //      }]
    //    }
    //  }
  }

  diariz.diarizationError = function(error){
    //  recognize error
  }
}
```
