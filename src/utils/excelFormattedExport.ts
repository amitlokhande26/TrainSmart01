/**
 * Enhanced Excel Export with Professional Formatting using ExcelJS
 * Includes bold headers, borders, serial numbers, and professional styling
 */

import ExcelJS from 'exceljs';

export interface ExcelFormattedOptions {
  filename?: string;
  sheetName?: string;
  includeSummary?: boolean;
  includeSerialNumbers?: boolean;
}

export interface FormattedData {
  [key: string]: any;
}

// Formats a value into "HH:MM Date" using 24h time, keeping locale date
function formatTimeAndDate(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const datePart = d.toLocaleDateString();
  return `${hours}:${minutes} | ${datePart}`;
}

/**
 * Creates a professionally formatted Excel workbook using ExcelJS
 */
export async function exportToExcelFormatted(
  data: FormattedData[],
  options: ExcelFormattedOptions = {}
): Promise<void> {
  const {
    filename = `export-${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName = 'Training Reports',
    includeSummary = false,
    includeSerialNumbers = true
  } = options;

  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Prepare headers
  const headers = Object.keys(data[0]);
  const serialNumberHeader = includeSerialNumbers ? ['Sr No.'] : [];
  const allHeaders = [...serialNumberHeader, ...headers];

  // Add headers row
  const headerRow = worksheet.addRow(allHeaders);
  
  // Style the header row
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF366092' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  });

  // Hide specific columns (B, F, G, S)
  // Note: Column indices are 0-based, so B=1, F=5, G=6, S=18
  const columnsToHide = [1, 5, 6, 18]; // B, F, G, S
  columnsToHide.forEach(colIndex => {
    if (colIndex < allHeaders.length) {
      worksheet.getColumn(colIndex + 1).hidden = true; // ExcelJS uses 1-based indexing
    }
  });

  // Add data rows
  data.forEach((row, index) => {
    const serialNumber = includeSerialNumbers ? [index + 1] : [];
    const rowData = [...serialNumber, ...Object.values(row)];
    const dataRow = worksheet.addRow(rowData);
    
    // Style the data row
    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  // Add summary row if requested
  if (includeSummary) {
    const summaryRow = createSummaryRowForExcel(data, allHeaders.length);
    const summaryDataRow = worksheet.addRow(summaryRow);
    
    // Style the summary row
    summaryDataRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }
      };
      cell.alignment = { vertical: 'middle' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  }

  // Auto-size columns
  worksheet.columns.forEach((column, index) => {
    let maxLength = 10; // Minimum width
    
    // Special handling for Sr No. column (index 0)
    if (index === 0 && includeSerialNumbers) {
      // Calculate width based on the largest serial number
      const maxSerialNumber = data.length;
      const serialNumberLength = String(maxSerialNumber).length;
      column.width = Math.max(serialNumberLength + 2, 8); // Minimum 8, just enough for "Sr No." and numbers
      return;
    }
    
    // Check header length
    if (allHeaders[index]) {
      maxLength = Math.max(maxLength, allHeaders[index].length);
    }
    
    // Check data lengths
    data.forEach(row => {
      const rowData = includeSerialNumbers ? [index + 1, ...Object.values(row)] : Object.values(row);
      if (rowData[index]) {
        const cellLength = String(rowData[index]).length;
        maxLength = Math.max(maxLength, cellLength);
      }
    });
    
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  // Freeze the header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Save the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Creates a summary row for Excel export
 */
function createSummaryRowForExcel(data: FormattedData[], numCols: number): any[] {
  const totalCompletions = data.length;
  const withTrainerSignoff = data.filter(row => 
    row.has_trainer_signoff === 'Yes' || row.has_trainer_signoff === true
  ).length;
  const pendingSignoff = totalCompletions - withTrainerSignoff;
  const uniqueEmployees = new Set(data.map(row => row.employee)).size;
  const uniqueModules = new Set(data.map(row => row.module_title)).size;

  const summaryRow = new Array(numCols).fill('');
  summaryRow[0] = 'SUMMARY';
  summaryRow[1] = `Total: ${totalCompletions} completions`;
  summaryRow[2] = `${uniqueEmployees} unique employees`;
  summaryRow[3] = `${uniqueModules} unique modules`;
  summaryRow[4] = `Approved: ${withTrainerSignoff}`;
  summaryRow[5] = `Pending: ${pendingSignoff}`;

  return summaryRow;
}

/**
 * Training Reports specific formatted Excel export
 */
export async function exportTrainingReportsExcelFormatted(
  data: FormattedData[],
  options: Partial<ExcelFormattedOptions> = {}
): Promise<void> {
  const professionalHeaders = {
    completion_id: 'Completion ID',
    employee: 'Employee Name',
    employee_email: 'Employee Email',
    module_title: 'Training Module',
    module_version: 'Module Version',
    due_date: 'Due Date',
    completed_at: 'Completed Date',
    line_name: 'Production Line',
    category_name: 'Category',
    signed_name: 'Employee Signature',
    signed_email: 'Employee Email (Signature)',
    signed_at: 'Employee Signed At',
    trainer_name: 'Trainer Name',
    trainer_email: 'Trainer Email',
    trainer_signed_name: 'Trainer Signature',
    trainer_signed_email: 'Trainer Email (Signature)',
    trainer_signed_at: 'Trainer Signed At',
    assignment_id: 'Assignment ID',
    has_trainer_signoff: 'Trainer Approved'
  };

  // Format data for Excel export
  const formattedData = data.map(row => {
    const formattedRow: any = {};
    Object.keys(row).forEach(key => {
      const newKey = professionalHeaders[key as keyof typeof professionalHeaders] || key;
      let value = row[key];

      // Format specific fields
      if (key === 'completed_at' || key === 'due_date') {
        value = value ? new Date(value).toLocaleDateString() : '';
      } else if (key === 'signed_at' || key === 'trainer_signed_at') {
        value = formatTimeAndDate(value);
      } else if (key === 'has_trainer_signoff') {
        if (typeof value === 'boolean') {
          value = value ? 'Yes' : 'No';
        } else if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          value = (normalized === 'yes' || normalized === 'true' || normalized === '1') ? 'Yes' : 'No';
        } else if (typeof value === 'number') {
          value = value === 1 ? 'Yes' : 'No';
        } else {
          value = 'No';
        }
      } else if (key === 'module_version') {
        value = value ? `v${value}` : 'v1.0';
      }

      formattedRow[newKey] = value;
    });
    return formattedRow;
  });

  const defaultOptions: ExcelFormattedOptions = {
    filename: `training-reports-${new Date().toISOString().split('T')[0]}.xlsx`,
    sheetName: 'Training Reports',
    includeSummary: false,
    includeSerialNumbers: true
  };

  await exportToExcelFormatted(formattedData, { ...defaultOptions, ...options });
}