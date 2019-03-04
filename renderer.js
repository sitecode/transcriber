'use strict';
const remote = require('electron').remote;
const app = remote.app;
//https://github.com/nathanbuchar/electron-settings/wiki/API-documentation
const settings = remote.require('electron-settings');

const fs = require("fs");
const path = require('path');
//TODO add fast and back forward 10 sec buttons, and pause on f8
//TODO add transcribing stop button
//DONE add spellchecking
	//https://ourcodeworld.com/articles/read/485/how-to-implement-and-enable-the-grammar-and-spellchecker-in-electron-framework
//TODO add settings windows
//TODO add about window
//TODO add hamberger menu
//TODO add option to print
//TODO create keyboard shortcut to ff and rw audio
//TODO get a list a currently plugged in usb drives, instead of dir_search maybe
	//https://stackoverflow.com/questions/15878969/enumerate-system-drives-in-nodejs
//DONE add tab key, in textarea
//DONE store textarea location/scroll position and cursor position
//TODO FIX auto play can be interrupted and stop
//TODO allow bigger font size in text area
//TODO set max-width on textarea


// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
window.HELP_IMPROVE_VIDEOJS = false;
//window.$ = jQuery;
var transcribing = true;
var typing = false;
var progress = 0;
var work = {audio:{}, text:{}, date:{}};
var audio;

const TYPING_STOP_WAIT = 2200;//msec
const TYPING_JUMP_BACK = 4.20;//sec


var dir_search = 'F:/VOICE';//'/Users';
var dir_backup = app.getPath('userData')+'/Backups';
var backup_file = true;

var supported = ['.mp3'];//audio file supported
var _getAllFilesFromFolder = function(dir, filter) {
    var results = [];

try{
    fs.readdirSync(dir).forEach(function(file) {
//console.log(path.extname(file));
	var extname = path.extname(file);
	if (extname && !filter.includes(extname.toLowerCase())) {
		return;
	}
        file = dir+'/'+file;
        var stat = fs.statSync(file);

        if (stat && stat.isDirectory()) {
            results = results.concat(_getAllFilesFromFolder(file, filter))
        } else results.push(file);
    })

//sort in reverse creation time
results = results
 .map(function(v) { 
                  return { name:v,
                           time:fs.statSync(v).mtime.getTime()
                         }; 
               })
               .sort(function(a, b) { //console.log(a,b,a.time < b.time?1:-1);
			return a.time < b.time?1:-1; })
               .map(function(v) { return v.name; });

	;
  } catch (err) {
	console.log(err);
  }
    return results;
};
//mkdirSync(path.resolve('./first/second/third'))
const _mkdirSync = function (dirPath) {
  try {
    fs.mkdirSync(dirPath)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}
//mkdirpSync('first/second/third')
const _mkdirpSync = function (dirPath) {
  const parts = dirPath.split(/\\|\//);

  // For every part of our path, call our wrapped mkdirSync()
  // on the full path until and including that part
  for (let i = 1; i <= parts.length; i++) {
    _mkdirSync(path.join.apply(null, parts.slice(0, i)))
  }
}
const _backup = function (dirPath) {
  const parts = dirPath.split(path.sep)

mkdirpSync(file);
  // For every part of our path, call our wrapped mkdirSync()
  // on the full path until and including that part
  for (let i = 1; i <= parts.length; i++) {
    _mkdirSync(path.join.apply(null, parts.slice(0, i)))
  }
}
String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return 'h' + Math.abs(hash);
};
function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
}


//TODO delete files off of recorder older than a year and if already backuped on the computer
var loadSelect = function(){
	$('#chooser select option[value="0"]').text('Loading...').show();
	var files = _getAllFilesFromFolder(dir_search,supported);
	//console.log(files);
	files.map(file => {
//console.log(file);
		$('#chooser select').append('<option value="' + file + '" data-hash="'+ file.hashCode() +'">' + file + '</option>');
	});
//TODO also list or update backup files

	if (settings.has('work')){
		var works = settings.get('work');
		Object.keys(works).map(key => {
			var work = works[key];
			if (work && work.hash) {
				var option = $('#chooser select').find('[data-hash="'+work.hash+'"]');
				if (option.length) {
					option.text('*'+option.text());
				} else {
					$('#chooser select').append('<option value="' + work.file + '" data-hash="'+ work.hash +'">*' + work.file + '</option>');
				}
			}
		});
	}
	$('#chooser select option[value="0"]').hide().text('Select audio...');
}
var onChoose = function(file){
	//save current work
	saveWork(work);

	var fileBackup = dir_backup + path.sep + file.replace(/\:/, '---DRIVE');
	var fileBackupDir = path.dirname(fileBackup);
//console.log(fileBackup,fileBackupDir);
	if (!fs.existsSync(fileBackup)) {
		if (!fs.existsSync(file)) {
			alert(file + ' not found. Did you remove the device?');
			return false;
		}
//console.log('backing up', fileBackup);
		//create sub dirs
		_mkdirpSync(fileBackupDir);
		fs.copyFileSync(file, fileBackup);//, COPYFILE_EXCL);
	}
	//assume that fileBackup is now available

	//save settings is not exist
	var hash = file.hashCode();
//console.log(hash, 'for', file);
	if (!settings.has('work.' + hash )){
		work = {};
		work.file = file;
		work.hash = hash;
		work.fileBackup = fileBackup;
		work.audio = {};
		work.audio.currentTime = 0;
		work.audio.volume = settings.get('current.audio.volume');
		work.audio.progress = 0;
		work.text = {};
		work.text.current = '';
		work.text.selectionStart = 0;
		work.text.scrollHeight = 0;
		work.date = {};
		work.date.created = new Date().toJSON();
//console.log('no setting found, create new', work);

		//save for next time
		settings.set('work.' + hash, work);
	}
	work = settings.get('work.' + hash);
	loadWork(work);
	return true;
}
var loadWork = function(work) {
	$('#chooser select').find('[data-hash="'+work.hash+'"]').prop('selected', true);
	$('#audioSource').prop('src',work.fileBackup);
	audio = $('#audio')[0];
	audio.load();
	if (work.audio.currentTime)
		audio.currentTime = work.audio.currentTime;
	if (work.audio.volume)
		audio.volume = work.audio.volume;
	audio.play();

	progress = work.audio.progress;

	$('#texter textarea').val(work.text.current).focus();
//console.log(JSON.stringify(work));
	var text = $('#texter textarea').get(0);
	text.selectionStart = 0;
	if (work.text.selectionStart)
		text.selectionStart = work.text.selectionStart;
	text.selectionEnd = 0;
	if (work.text.selectionEnd)
		text.selectionEnd = work.text.selectionEnd;
	text.scrollTop = 0;
	if (work.text.scrollTopPercent)
		text.scrollTop = text.scrollHeight * work.text.scrollTopPercent;
}
var saveWork = function(work) {
	$('#audioSource').prop('src',work.fileBackup);
	audio = $('#audio')[0];
	work.audio.currentTime = audio.currentTime;
	work.audio.volume = audio.volume;
	work.audio.progress = progress;

	work.text.past = work.text.current;
	work.text.current = $('#texter textarea').val();
	var text = $('#texter textarea').get(0);
	work.text.scrollTopPercent = text.scrollTop / text.scrollHeight;
	work.text.selectionStart = text.selectionStart;
	work.text.selectionEnd = text.selectionEnd;
//console.log(JSON.stringify(work));

	work.date.modified = new Date().toJSON();
	settings.set('work.' + work.hash, work);
}

//make sure back dir works
_mkdirSync(dir_backup);


$(document).ready(function() {
	//var typingStartTimeout;
	var typingStart = function(){
		//console.log('start typing' + audio.currentTime);
		typing = true;
		//remember the spot
		audio.pause();
		progress = audio.currentTime;
	}
	var typingStopTimeout;
	var typingStop = function(){
		//console.log('stop typing');
		typing = false;
		//playback at the part	
		audio.currentTime = progress - (audio.playbackRate * TYPING_JUMP_BACK);
		audio.play();
	}

	$('#texter textarea').on('keyup', function(e ){
		//https://djkeh.github.io/articles/Typing-tab-key-inside-textarea-using-javascript/
		if (e.keyCode == 9) {//tab key
			e.preventDefault();
			var text = $('#texter textarea').get(0);
			var pos = text.selectionStart;
			text.value = text.value.substring(0, pos) + "\t" + text.value.substring(pos, text.value.length);
			text.selectionStart = pos+1;
			text.selectionEnd = text.selectionStart;
		}
		//https://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
		if (e.keyCode < 48 || e.keyCode > 106 ) //not a char or num
			return; //ignore that input

		if (transcribing) {
			clearTimeout(typingStopTimeout);
			if (!typing) {
			//ignore arrows and enter, or just non-letters
				typingStart();
		//		typingStartTimeout = setTimeout(typingStart, 0);
			} else {
				typingStopTimeout = setTimeout(typingStop, TYPING_STOP_WAIT);
			}
		}
	});

/*
	$('#chooser select').on('click', function(){
		var files = _getAllFilesFromFolder(,supported);
		//console.log(files);
		files.map(file => {
//console.log(file);
			//$('#chooser select').append('<option value="' + file + ">' + file + '</option>');
		});
	});
*/
	$('#chooser select').on('change', function(){
		var file = $(this).val();
//console.log(file);
		onChoose(file);
	});

	//print button
	$(document).on('click','#print', () => {
		require('electron').ipcRenderer.send('print', '<pre>'+$('#texter textarea').val()+'</pre>');
	});


	//load
	if (settings.has('current.dir.search')){
		dir_search = settings.get('current.dir.search');
	}
	loadSelect();
	if (settings.has('current.workHash')){
		var hash = settings.get('current.workHash');
		if (settings.has('work.'+hash)){
			work = settings.get('work.'+hash);
			loadWork(work);
		}
	}

    //var suggests = ["hello", "world"];
  if (settings.has('current.suggests')) {
    var suggests = settings.get('current.suggests');
//console.log('suggests', suggests);
    $("#texter textarea").asuggest(suggests, {
     //   'delimiters': ',:',
        'minChunkSize': 3,
        'stopSuggestionKeys': [$.asuggestKeys.RETURN],
	'endingSymbols': '',
//        'cycleOnTab': true
    });
  }
	

	//save settings
	$(window).on("beforeunload", () => { 
		settings.set('current.progress', progress);
		settings.set('current.audio.currentTime', audio.currentTime);
		settings.set('current.audio.volume', audio.volume);
		settings.set('current.dir.search', dir_search);
		settings.set('current.text', $('#texter textarea').val());
		if (work.hash) {
			settings.set('current.workHash', work.hash);
		}

		saveWork(work);
		if (work.text.current){
			//get all words separated by spaces longer than 6 chars
			var newSuggests = work.text.current.replace(/[\n\r\,\?\.\:\;\'\"\(\)\*\&\^\%\$\#\@\!]/g, ' ').replace(/\s{2,}/g, ' ').split(' ').sort().filter(word => word.length > 6);;
			var suggests = [];
			if (settings.has('current.suggests')) {
				suggests = settings.get('current.suggests');
			}
			suggests = arrayUnique(suggests.concat(newSuggests));
			suggests.sort();
//console.log(suggests, 'new suggests');
			settings.set('current.suggests', suggests);
		}
	})
  
});

/*
//https://github.com/electron/electron/blob/master/docs/api/web-frame.md
const {webFrame} = require('electron')
webFrame.setSpellCheckProvider('en-US', true, {
  spellCheck (text) {
    return !(require('spellchecker').isMisspelled(text))
  }
})
*/


/*
//https://stackoverflow.com/questions/18973655/how-to-ingnore-hidden-files-in-fs-readdir-result
fs.readdir('/path/to/directory', (err, list) => {
  list = list.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));

  // Your code
});

*/
