/**
 * Standardized date formatting utilities for TrainSmart application
 * All dates should use DDMMYYYY format for consistency
 */

/**
 * Format a date to DD/MM/YYYY format for display
 * @param date - Date object or date string
 * @returns Formatted date string in DD/MM/YYYY format
 */
export const formatDateForDisplay = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Format a date to DDMMYYYY format for input fields (no separators)
 * @param date - Date object or date string
 * @returns Formatted date string in DDMMYYYY format
 */
export const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '');
};

/**
 * Parse a DDMMYYYY string to a Date object
 * @param dateString - Date string in DDMMYYYY format
 * @returns Date object or null if invalid
 */
export const parseDDMMYYYY = (dateString: string): Date | null => {
  if (!dateString || dateString.length !== 8) return null;
  
  const day = parseInt(dateString.substring(0, 2), 10);
  const month = parseInt(dateString.substring(2, 4), 10);
  const year = parseInt(dateString.substring(4, 8), 10);
  
  // Validate date components
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
    return null;
  }
  
  const date = new Date(year, month - 1, day);
  
  // Check if the date is valid (handles cases like 31/02/2024)
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
};

/**
 * Format date and time for display (DD/MM/YYYY HH:MM)
 * @param date - Date object or date string
 * @returns Formatted date and time string
 */
export const formatDateTimeForDisplay = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const datePart = dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  const timePart = dateObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  return `${datePart} ${timePart}`;
};

/**
 * Get current date in DDMMYYYY format for default values
 * @returns Current date in DDMMYYYY format
 */
export const getCurrentDateDDMMYYYY = (): string => {
  return formatDateForInput(new Date());
};

/**
 * Get current date in DD/MM/YYYY format for display
 * @returns Current date in DD/MM/YYYY format
 */
export const getCurrentDateFormatted = (): string => {
  return formatDateForDisplay(new Date());
};
