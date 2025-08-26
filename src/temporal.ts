export enum TemoralPrecision {
    Year = 1,
    Month = 2,
    Day = 3,
    Hour = 4,
    Minute = 5,
    Second = 6,
    Millisecond = 7,
}

export const DateTimePrecisionMap: Record<TemoralPrecision, number> = {
    [TemoralPrecision.Year]: 4,
    [TemoralPrecision.Month]: 6,
    [TemoralPrecision.Day]: 8,
    [TemoralPrecision.Hour]: 10,
    [TemoralPrecision.Minute]: 12,
    [TemoralPrecision.Second]: 14,
    [TemoralPrecision.Millisecond]: 16,
}

export interface TemporalValue {
    precision: TemoralPrecision;
    type: "date" | "dateTime" | "time";
}

export interface Date extends TemporalValue {
    year: number;
    month?: number;
    day?: number;
}

// 2015-02-01T12:00:00Z => timezone = 0
export interface DateTime extends Date {
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
    timeZoneOffset?: number;
}

export interface Time extends TemporalValue {
    hour: number;
    minute?: number;
    second?: number;
    millisecond?: number;
}

export interface TimeQuantity {
    unit: TemoralPrecision;
    value: number;
}

export function parse(string: string): Date | DateTime | Time {
    throw new Error("parse not implemented");
}

export function dateTime(year: number, month?: number, day?: number, hour?: number, minute?: number, second?: number, millisecond?: number, timeZoneOffset?: number): DateTime {
    return {
        precision: TemoralPrecision.Year,
        type: "dateTime",
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        timeZoneOffset,
    }
}

export function newDate(year: number, month?: number, day?: number): Date {
    if (day) {
        return {
            precision: TemoralPrecision.Day,
            type: "date",
            year,
            month,
            day,
        }
    }
    if (month) {
        return {
            precision: TemoralPrecision.Month,
            type: "date",
            year,
            month,
        }
    }
    return {
        precision: TemoralPrecision.Year,
        type: "date",
        year,
    }       
}

export function newTimeQuantity(value: number, unit: TemoralPrecision): TimeQuantity {
    return {
        unit,
        value,
    }
}

export function newTime(hour: number, minute?: number, second?: number, millisecond?: number): Time {
    return {
        precision: TemoralPrecision.Hour,
        type: "time",
        hour,
        minute,
        second,
        millisecond,
    }
}

// update yers, months if overflow
function calculateComponents(date: Date): Date {
    return date;
}

// convert quantity to date precision and add to date
function addToDate(date: Date, quantity: TimeQuantity): Date {
    return date;
}

export function add<T extends Date | DateTime | Time>(temporal: T, quantity: TimeQuantity): T {
    if (temporal.type === "date") {
        return addToDate(temporal as Date, quantity) as T;
    }
    throw new Error("add not implemented");
}

export function subtract<T extends Date | DateTime | Time>(temporal: T, quantity: TimeQuantity): T {
    throw new Error("subtract not implemented");
}

export function toDateTime<T extends Date | DateTime | Time | string>(temporal: T): DateTime {
    throw new Error("toDateTime not implemented");
}