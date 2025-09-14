import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4
}

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
    stack?: string;
}

export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    logDir: string;
    maxFileSize: number; // in MB
    dateFormat: string;
}

export default class Logging {
    private static config: LoggerConfig = {
        level: LogLevel.INFO,
        enableConsole: true,
        enableFile: true,
        logDir: './logs',
        maxFileSize: 10,
        dateFormat: 'en-US'
    };

    private static readonly levelColors = {
        [LogLevel.DEBUG]: chalk.gray,
        [LogLevel.INFO]: chalk.blue,
        [LogLevel.WARN]: chalk.yellow,
        [LogLevel.ERROR]: chalk.red,
        [LogLevel.FATAL]: chalk.magenta
    };

    private static readonly levelNames = {
        [LogLevel.DEBUG]: 'DEBUG',
        [LogLevel.INFO]: 'INFO',
        [LogLevel.WARN]: 'WARN',
        [LogLevel.ERROR]: 'ERROR',
        [LogLevel.FATAL]: 'FATAL'
    };

    /**
     * Configure the logger
     */
    public static configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
        
        if (this.config.enableFile && !existsSync(this.config.logDir)) {
            mkdirSync(this.config.logDir, { recursive: true });
        }
    }

    /**
     * Create a formatted log entry
     */
    private static createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toLocaleString(this.config.dateFormat),
            level: this.levelNames[level],
            message,
            data
        };

        if (level >= LogLevel.ERROR && data instanceof Error) {
            entry.stack = data.stack;
        }

        return entry;
    }

    /**
     * Write log to console
     */
    private static writeToConsole(entry: LogEntry, level: LogLevel): void {
        if (!this.config.enableConsole) return;

        const colorFn = this.levelColors[level];
        const timestamp = chalk.gray(`[${entry.timestamp}]`);
        const levelLabel = colorFn(`[${entry.level}]`);
        
        let output = `${timestamp} ${levelLabel} ${entry.message}`;
        
        if (entry.data && typeof entry.data !== 'undefined') {
            if (typeof entry.data === 'string') {
                output += ` ${colorFn(entry.data)}`;
            } else {
                console.log(output);
                console.log(entry.data);
                return;
            }
        }

        if (entry.stack) {
            output += `\n${chalk.red(entry.stack)}`;
        }

        console.log(output);
    }

    /**
     * Write log to file
     */
    private static writeToFile(entry: LogEntry): void {
        if (!this.config.enableFile) return;

        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = join(this.config.logDir, `app-${date}.log`);
            
            const logLine = JSON.stringify(entry) + '\n';
            writeFileSync(filename, logLine, { flag: 'a' });
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Core logging method
     */
    private static log(level: LogLevel, message: string, data?: any): void {
        if (level < this.config.level) return;

        const entry = this.createLogEntry(level, message, data);
        
        this.writeToConsole(entry, level);
        this.writeToFile(entry);
    }

    // Public logging methods
    public static debug = (message: string, data?: any): void => {
        this.log(LogLevel.DEBUG, message, data);
    };

    public static info = (message: string, data?: any): void => {
        this.log(LogLevel.INFO, message, data);
    };

    public static warn = (message: string, data?: any): void => {
        this.log(LogLevel.WARN, message, data);
    };

    public static error = (message: string, error?: Error | any): void => {
        this.log(LogLevel.ERROR, message, error);
    };

    public static fatal = (message: string, error?: Error | any): void => {
        this.log(LogLevel.FATAL, message, error);
        // In a real application, you might want to exit the process
        // process.exit(1);
    };

    // Convenience methods
    public static success = (message: string, data?: any): void => {
        const timestamp = chalk.gray(`[${new Date().toLocaleString()}]`);
        const label = chalk.green('[SUCCESS]');
        const output = `${timestamp} ${label} ${chalk.greenBright(message)}`;
        
        if (data) {
            console.log(output);
            console.log(data);
        } else {
            console.log(output);
        }
    };

    /**
     * Create a child logger with context
     */
    public static child(context: string) {
        return {
            debug: (message: string, data?: any) => this.debug(`[${context}] ${message}`, data),
            info: (message: string, data?: any) => this.info(`[${context}] ${message}`, data),
            warn: (message: string, data?: any) => this.warn(`[${context}] ${message}`, data),
            error: (message: string, error?: Error | any) => this.error(`[${context}] ${message}`, error),
            fatal: (message: string, error?: Error | any) => this.fatal(`[${context}] ${message}`, error),
            success: (message: string, data?: any) => this.success(`[${context}] ${message}`, data)
        };
    }

    /**
     * Performance timing utility
     */
    public static time(label: string): () => void {
        const start = process.hrtime.bigint();
        
        return () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            this.info(`${label} took ${duration.toFixed(2)}ms`);
        };
    }

    // Legacy compatibility
    public static logInfo = this.info;
    public static warning = this.warn;
}