import { createLogger,format, transports } from "winston";
import { tr } from "zod/locales";

const {combine, timestamp, printf, colorize} = format;

const myFormat = printf(({level, message, timestamp}) => {
    return `{timestamp} [${level}]: ${message}`;
});

export const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss'}),
        myFormat
    ),
    transports: [
        new  transports.Console({
            format: combine(colorize(),myFormat)
        }),
        new transports.File({ filename: 'logs/error.log', level: 'error'}),
        new transports.File({ filename: 'logs/combined.log'})
    ],
});