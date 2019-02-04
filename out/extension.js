"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const mkdirp = require("mkdirp");
const vscode = require("vscode");
const readdirp = require('readdirp');
const untildify = require('untildify');
function activate(context) {
    var config = vscode.workspace.getConfiguration('quipy').get('paths');
    let disposable = vscode.commands.registerCommand('quipy.copy', (file, files) => {
        if (!config || !config.length) {
            vscode.window.showErrorMessage('No paths configured');
        }
        if (config.length > 1) {
            // Multiple paths, show quick pick to select one
            const quickPick = vscode.window.createQuickPick();
            quickPick.items = config.map((item) => {
                if (item.path.lastIndexOf('/') !== item.path.length - 1) {
                    item.path += '/';
                }
                return {
                    label: item.name,
                    detail: item.path,
                    description: item.keepFolderStructure ? 'Keep folder structure' : undefined
                };
            });
            quickPick.show();
            quickPick.onDidChangeSelection(selected => {
                if (selected[0] && selected[0].detail) {
                    var conf = config.filter(item => {
                        return item.name === selected[0].label;
                    });
                    if (!conf.length) {
                        throw new Error('Selected configuration not found!?');
                    }
                    prepareCopy(files, conf[0]);
                    quickPick.hide();
                }
            });
        }
        else {
            prepareCopy(files, config[0]);
        }
    });
    // Check for config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('quipy.paths')) {
            config = vscode.workspace.getConfiguration('quipy').get('paths');
        }
    }));
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function extractFilesFromFolders(files) {
    const returnFiles = [];
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        for (var i = 0; i < files.length; i++) {
            let fileOrDir = files[i];
            yield new Promise((res, rej) => {
                fs.lstat(fileOrDir.fsPath, (err, stats) => {
                    if (stats.isFile()) {
                        returnFiles.push(fileOrDir);
                        res();
                    }
                    else {
                        readdirp({ root: fileOrDir.fsPath, depth: 5 }).on('data', function (entry) {
                            if (entry.stat.isFile()) {
                                returnFiles.push({ fsPath: entry.fullPath });
                            }
                            res();
                        });
                    }
                });
            });
        }
        resolve(returnFiles);
    }));
}
function prepareCopy(incomingFiles, config) {
    extractFilesFromFolders(incomingFiles).then((files) => {
        if (config.path.lastIndexOf('/') !== config.path.length - 1) {
            config.path += '/';
        }
        files.forEach(file => {
            let addPath = file.fsPath.substr(file.fsPath.lastIndexOf('/') + 1); // Filename
            if (vscode.workspace.rootPath && config.keepFolderStructure) {
                addPath = file.fsPath.replace(vscode.workspace.rootPath, ''); // Mirrored path + filename
            }
            if (addPath.indexOf('/') === 0) {
                addPath = addPath.substr(1);
            }
            checkDirAndCopy(file.fsPath, config.path + addPath, config);
        });
    });
}
function checkDirAndCopy(file, path, config) {
    var dir = untildify(path.substr(0, path.lastIndexOf('/')));
    if (config.createFolderStructureIfNotExist) {
        mkdirp(dir, (err) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
            }
            copy(file, path);
        });
    }
    else {
        copy(file, path);
    }
}
function copy(file, path) {
    fs.copyFile(file, untildify(path), err => {
        if (err) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
        var filename = file.substr(file.lastIndexOf('/') + 1);
        vscode.window.showInformationMessage(filename + ' was successfully copied');
    });
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map