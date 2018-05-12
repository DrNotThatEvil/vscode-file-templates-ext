"use strict";
import fs = require("fs");
import os = require("os");
import path = require("path");
import { WorkspaceConfiguration } from "vscode";
/**
 * Main class to handle the logic of the File Templates
 * @export
 * @class TemplatesManager
 */
export default class TemplatesManager {

    private config: WorkspaceConfiguration;

    constructor(config: WorkspaceConfiguration) {
        this.config = config;
    }

    /**
     * Returns a list of available file templates by reading the Templates Directory.
     * @returns string[]
     */
    public getTemplates(): string[] {
        // @TODO make this async (use promises ???)
        const templateDir: string = this.getTemplatesDir();
        const templateFiles: string[] = fs.readdirSync(templateDir).map((item) => {
            if (!/^\./.exec(item)) {
                return fs.statSync(path.join(templateDir, item)).isFile() ? item : null;
            }
            return null;
        }).filter((filename) =>  filename !== null);
        return templateFiles;
    }

    /**
     * Read the contents of a templates
     * @param filename The name of the template file.
     * @return Buffer
     */
    public getTemplate(filename): string {
        return fs.readFileSync(path.join(this.getTemplatesDir(), filename), "utf8");
    }

    /**
     * Returns the templates directory location.
     * If no user configuration is found, the extension will look for
     * templates in USER_DATA_DIR/Code/FileTemplates.
     * Otherwise it will look for the path defined in the extension configuration.
     * @return {string}
     */
    public getTemplatesDir(): string {
        return this.config.get("templates_dir", this.getDefaultTemplatesDir());
    }

    /**
     * Creates the templates dir if not exists
     * @throw Error
     */
    public createTemplatesDirIfNotExists() {
        const templatesDir = this.getTemplatesDir();
        fs.mkdir(templatesDir, "0755", (err) => {
            if (err && err.code !== "EEXIST") {
                throw Error("Failed to created templates directory " + templatesDir);
            }
        });
    }

    /**
     * Returns the default templates location based on the user OS.
     * @returns {string}
     */
    private getDefaultTemplatesDir(): string {
        let userDataDir = null;

        switch (process.platform) {
            case "linux":
                userDataDir = path.join(os.homedir(), ".config");
                break;
            case "darwin":
                userDataDir = path.join(os.homedir(), "Library", "Application Support");
                break;
            case "win32":
                userDataDir = process.env.APPDATA;
                break;
            default:
                throw Error("Unrecognizable operative system");
        }

        return path.join(userDataDir, "Code", "User", "FileTemplates");
    }

}
