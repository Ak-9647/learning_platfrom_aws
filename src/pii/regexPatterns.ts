export const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/g;
export const phonePattern = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g; // US-centric
export const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g; // US SSN
export const creditCardPattern = /\b(?:\d[ -]*?){13,16}\b/g;

export const defaultRegexes: RegExp[] = [emailPattern, phonePattern, ssnPattern, creditCardPattern];
