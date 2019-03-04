// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain, shell} = require('electron')
const settings = require('electron-settings');
const path = require('path');

//https://github.com/mongodb-js/electron-squirrel-startup
if(require('electron-squirrel-startup')) app.quit();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let printWindow


function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600,
     icon: path.join(__dirname, 'assets/icon64.png')

})

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  //remove default menu
  //mainWindow.setMenu(null);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
	printWindow.close();
  })

    printWindow = new BrowserWindow();
    //printWindow.loadURL("file://" + __dirname + "/print.html");
    printWindow.loadFile('print.html')
    printWindow.hide();
    printWindow.webContents.openDevTools();
    printWindow.on("closed", () => {
        printWindow = undefined;
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

//https://discuss.atom.io/t/how-to-disable-the-default-menubar/17722/6
app.on('browser-window-created',function(e,window) {
	window.setMenu(null);
});


// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.



//code to print
//retransmit it to printWindow
//https://stackoverflow.com/questions/37627064/how-to-print-a-div-in-electronjs#
ipcMain.on("printPDF", (event, content) => {
    console.log(content);
    printWindow.webContents.send("printPDF", content);
});
// when worker window is ready
ipcMain.on("readyToPrintPDF", (event) => {
    const pdfPath = path.join(os.tmpdir(), 'print.pdf');
    // Use default printing options
    printWindow.webContents.printToPDF({}, function (error, data) {
        if (error) throw error
        fs.writeFile(pdfPath, data, function (error) {
            if (error) {
                throw error
            }
            shell.openItem(pdfPath)
            event.sender.send('wrote-pdf', pdfPath)
        })
    })
});

ipcMain.on('print', (event, content) => {
  //the one call method if it works
  //  require('electron').ipcRenderer.send('gpu', document.body.innerHTML);
  printWindow.webContents.executeJavaScript(`
            document.body.innerHTML = ` +JSON.stringify(content)+`;
  `);
    printWindow.webContents.print({});

    //printWindow.webContents.send('print', content);
});

ipcMain.on('readyToPrint', (event) => {
    printWindow.webContents.print({});
});

