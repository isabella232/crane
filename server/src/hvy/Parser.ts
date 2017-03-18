
import { IConnection, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Program } from 'php-parser';
import { Message } from 'code-sniper';

var phpParser = require("php-parser");
var codeSniper = require("code-sniper");
let options = {
    parser: {
        extractDoc: true,
        suppressErrors: true
    },
    ast: {
        withPositions: true
    }
};
export class Parser {
    protected parser;
    protected diagnostics;
    protected scanning;
    protected connection:IConnection;
    /**
     * Initialize a new parser with diagnostic capabilities
     * @param connection 
     * @param diag
     */
    public constructor(connection:IConnection, diag: boolean) {
        this.connection = connection;
        if (diag) {
            this.diagnostics = new codeSniper({
                parser: options
            });
            this.parser = this.diagnostics.getParser();
        } else {
            this.parser = new phpParser(options);
        }
    }


    /**
     * Scan and ignore diagnostic tools
     * @param fn 
     */
    public withoutDiagnostics(fn) {
        var diagParser = null;
        if (this.diagnostics) {
            var diagParser = this.parser;
            this.parser = new phpParser(options);
        }
        var wait = new Promise(function(done, reject) {
            var result = fn(done, reject);
            if (result instanceof Promise) {
                result.then(done, reject);
            }
        });
        return wait.then(() => {
            if (diagParser) {
                this.parser = diagParser;
            }
        }).catch(() => {
            if (diagParser) {
                this.parser = diagParser;
            }
        });
    }

    /**
     * Indicate to diagnostic tool that you are currently scan multiple
     * files, so the cross files passes will be trigger at the end of the scan
     */
    public scan(fn) {
        this.scanning = true;
        var wait = new Promise(function(done, reject) {
            var result = fn(done, reject);
            if (result instanceof Promise) {
                result.then(done, reject);
            }
        });
        return wait.then(() => {
            this.scanning = false;
            if (this.diagnostics) {
                this.sendDiagnostics();
            }
        }).catch(() => {
            this.scanning = false;
            if (this.diagnostics) {
                this.sendDiagnostics();
            }
        });
    }

    public parse(code: string, filename: string): Program {
        var ast:Program = this.parser.parseCode(code, filename);
        if (this.diagnostics && !this.scanning) {
            this.sendDiagnostics(filename);
        }
        return ast;
    }
    /**
     * Flush diagnostics
     * @param filename 
     */
    protected sendDiagnostics(filename?: string) {
        if (!filename) {
            // flush every file
            let items = this.diagnostics.report.messages;
            for(var k in items) {
                if (items.hasOwnProperty(k)) {
                    this.sendDiagnostics(k);
                }
            }
            return;
        }
        let diagnostics = [];
        if (this.diagnostics) {
            let messages = this.diagnostics.report.getMessages(filename);
            for(let i = 0; i < messages.length; i++) {
                let severity:DiagnosticSeverity = DiagnosticSeverity.Hint;
                let message:Message = messages[i];
                if (message.level === Message.LEVEL_CRITICAL || 
                    message.level === Message.LEVEL_IMPORTANT
                ) {
                    severity = DiagnosticSeverity.Error;
                } else if (message.level === Message.LEVEL_WARNING) {
                    severity = DiagnosticSeverity.Warning;
                } else if (message.level === Message.LEVEL_NOTICE) {
                    severity = DiagnosticSeverity.Information;
                }
                diagnostics.push({
                    severity: severity,
                    range: {
                        start: { 
                            line: message.location.start.line - 1, 
                            character: message.location.start.col
                        },
                        end: { 
                            line: message.location.end.line - 1, 
                            character: message.location.end.col
                        }
                    },
                    message: message.text,
                    source: message.rule.namespace
                });
            }
            // todo : handle fixes
        }
        this.connection.sendDiagnostics({
            uri: 'file://' + filename,
            diagnostics: diagnostics
        });
    }
}