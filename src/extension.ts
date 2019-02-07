import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as vscode from 'vscode';

const readdirp = require('readdirp');
const untildify = require('untildify');
export function activate(context: vscode.ExtensionContext) {
    var config = <any[]>vscode.workspace.getConfiguration('quipy').get('paths');

    let disposable = vscode.commands.registerCommand('quipy.copy', (file, files) => {
        if (!config || !config.length) {
            vscode.window.showErrorMessage('No paths configured');
        }

        if (config.length > 1) {
            // Multiple paths, show quick pick to select one
            const quickPick = vscode.window.createQuickPick();
            quickPick.items = config.map((item: any) => {
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
        } else {
            prepareCopy(files, config[0]);
        }
    });

    // Check for config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('quipy.paths')) {
                config = <any[]>vscode.workspace.getConfiguration('quipy').get('paths');
            }
        })
    );
    context.subscriptions.push(disposable);
}

function extractFilesFromFolders(files: any): Promise<any[]> {
    const returnFiles: any[] = [];
    return new Promise(async (resolve, reject) => {
        for (var i = 0; i < files.length; i++) {
            let fileOrDir = files[i];
            await new Promise((res, rej) => {
                fs.lstat(fileOrDir.fsPath, (err: NodeJS.ErrnoException, stats: fs.Stats) => {
                    if (stats.isFile()) {
                        returnFiles.push(fileOrDir);
                        res();
                    } else {
                        readdirp({ root: fileOrDir.fsPath, depth: 5 }).on('data', function(entry: any) {
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
    });
}
function prepareCopy(incomingFiles: any[], config: any) {
    extractFilesFromFolders(incomingFiles).then((files: any[]) => {
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

function checkDirAndCopy(file: string, path: string, config: any) {
    path = path.replace('/\\', '\\');
    var dir = path.indexOf('~') > 0 ? untildify(path.substr(0, path.lastIndexOf('/'))) : path.substr(0, path.lastIndexOf('\\'));
    if (config.createFolderStructureIfNotExist) {
        mkdirp(dir, (err: NodeJS.ErrnoException) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
            }

            copy(file, path);
        });
    } else {
        copy(file, path);
    }
}

function copy(file: string, path: string) {
    fs.copyFile(file, untildify(path), err => {
        if (err) {
            vscode.window.showErrorMessage(err.message);
            return;
        }
        var filename = file.substr(file.lastIndexOf('/') + 1);
        vscode.window.showInformationMessage(filename + ' was successfully copied');
    });
}

export function deactivate() {}
