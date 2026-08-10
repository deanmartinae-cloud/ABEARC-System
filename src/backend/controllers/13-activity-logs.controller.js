// Controllers extracted from src/backend/routes/13-activity-logs.routes.js.
// Keep this module immediately before its route module in the backend manifest.

const __routeController193 = (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const { whereClause, params } = buildActivityLogFilters(req.query);
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    db.get(`SELECT COUNT(*) as total FROM ActivityLogs ${whereClause}`, params, (countErr, countRow) => {
        if (countErr) return res.status(500).json({ error: countErr.message });
        
        // Get paginated data
        db.all(`
            SELECT 
                id, user_id, username, action, project_id, project_name, 
                requester, document_type, details, created_at, ip_address,
                (SELECT role FROM Users WHERE Users.id = ActivityLogs.user_id) AS user_role
            FROM ActivityLogs 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                logs: rows,
                total: countRow.total,
                page: parseInt(page),
                totalPages: Math.ceil(countRow.total / parseInt(limit))
            });
        });
    });
};

const __routeController194 = (req, res) => {
    const { whereClause, params } = buildActivityLogFilters(req.query);
    const exportInfo = activityLogExportDescriptor(req.query);
    
    db.all(`
        SELECT 
            id, user_id, username, action, project_id, project_name, 
            requester, document_type, details, created_at, ip_address
        FROM ActivityLogs 
        ${whereClause}
        ORDER BY created_at DESC
    `, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Create CSV content
        const header = 'ID,DateTime,UserID,Username,Action,ProjectID,ProjectName,Requester,DocumentType,Details,IPAddress\n';
        const csvRows = rows.map(row => {
            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '';
                return `"${String(val).replace(/"/g, '""')}"`;
            };
            return [
                row.id,
                row.created_at,
                row.user_id,
                row.username,
                row.action,
                row.project_id,
                row.project_name,
                row.requester,
                row.document_type,
                row.details,
                row.ip_address
            ].map(escapeCsv).join(',');
        });
        
        const csvContent = header + csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportInfo.stem}.csv"`);
        res.send(csvContent);
    });
};

const __routeController195 = (req, res) => {
    const { whereClause, params } = buildActivityLogFilters(req.query);
    const exportInfo = activityLogExportDescriptor(req.query);
    
    db.all(`
        SELECT 
            id, user_id, username, action, project_id, project_name, 
            requester, document_type, details, created_at, ip_address
        FROM ActivityLogs 
        ${whereClause}
        ORDER BY created_at DESC
    `, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Create HTML table that Excel can open
        const htmlHeader = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
            <head><meta charset="UTF-8"></head>
            <body>
            <table border="1">
                <thead>
                    <tr style="background-color: #4F46E5; color: white;">
                        <th>ID</th><th>DateTime</th><th>UserID</th><th>Username</th><th>Action</th>
                        <th>ProjectID</th><th>ProjectName</th><th>Requester</th><th>DocumentType</th>
                        <th>Details</th><th>IPAddress</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const htmlRows = rows.map(row => `
            <tr>
                <td>${row.id || ''}</td>
                <td>${row.created_at || ''}</td>
                <td>${row.user_id || ''}</td>
                <td>${(row.username || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(row.action || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${row.project_id || ''}</td>
                <td>${(row.project_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(row.requester || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(row.document_type || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${(row.details || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                <td>${row.ip_address || ''}</td>
            </tr>
        `).join('');
        
        const htmlFooter = '</tbody></table></body></html>';
        const htmlContent = htmlHeader + htmlRows + htmlFooter;
        
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="${exportInfo.stem}.xls"`);
        res.send(htmlContent);
    });
};

const __routeController196 = (req, res) => {
    const { whereClause, params } = buildActivityLogFilters(req.query);
    const exportInfo = activityLogExportDescriptor(req.query);
    
    db.all(`
        SELECT 
            id, user_id, username, action, project_id, project_name, 
            requester, document_type, details, created_at, ip_address
        FROM ActivityLogs 
        ${whereClause}
        ORDER BY created_at DESC
    `, params, async (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        try {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const pageSize = [842, 595]; // A4 landscape
            const margin = 28;
            const lineHeight = 12;
            const columns = [
              { title: 'ID', x: 28, width: 34 },
              { title: 'Date/Time', x: 66, width: 96 },
              { title: 'User', x: 166, width: 74 },
              { title: 'Action', x: 244, width: 98 },
              { title: 'Project', x: 346, width: 120 },
              { title: 'Document', x: 470, width: 100 },
              { title: 'Details', x: 574, width: 170 },
              { title: 'IP', x: 748, width: 66 }
            ];

            const clean = (value = '') => String(value || '-').replace(/\s+/g, ' ').trim();
            const pdfText = (value = '') => clean(value).replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
            const fitText = (value, width, size = 8) => {
              let text = pdfText(value);
              while (font.widthOfTextAtSize(text, size) > width && text.length > 4) text = text.slice(0, -4) + '...';
              return text;
            };

            let page;
            let y;
            const addPage = () => {
              page = pdfDoc.addPage(pageSize);
              const height = page.getHeight();
              page.drawText('Activity Logs Report', { x: margin, y: height - 30, size: 16, font: boldFont, color: rgb(0.22, 0.20, 0.70) });
              page.drawText(`Generated: ${new Date().toLocaleString()}   Total Records: ${rows.length}`, { x: margin, y: height - 48, size: 8, font });
              page.drawText(fitText(exportInfo.filterLabel, page.getWidth() - margin * 2, 8), { x: margin, y: height - 60, size: 8, font });
              y = height - 84;
              page.drawRectangle({ x: margin - 4, y: y - 4, width: page.getWidth() - margin * 2 + 8, height: 16, color: rgb(0.31, 0.27, 0.90) });
              columns.forEach(col => page.drawText(col.title, { x: col.x, y, size: 8, font: boldFont, color: rgb(1, 1, 1) }));
              y -= 18;
            };

            addPage();
            (rows || []).forEach((row, index) => {
              if (y < margin + 12) addPage();
              if (index % 2 === 0) {
                page.drawRectangle({ x: margin - 4, y: y - 3, width: page.getWidth() - margin * 2 + 8, height: 14, color: rgb(0.96, 0.97, 0.98) });
              }
              const values = [
                row.id,
                row.created_at ? new Date(row.created_at).toLocaleString() : '-',
                row.username || 'System',
                row.action,
                row.project_name,
                row.document_type,
                row.details,
                row.ip_address
              ];
              columns.forEach((col, colIndex) => {
                page.drawText(fitText(values[colIndex], col.width), { x: col.x, y, size: 8, font, color: rgb(0.12, 0.14, 0.18) });
              });
              y -= lineHeight;
            });

            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${exportInfo.stem}.pdf"`);
            res.setHeader('Content-Length', pdfBytes.length);
            res.send(Buffer.from(pdfBytes));
        } catch (pdfErr) {
            logError('ACTIVITY_LOGS_PDF_EXPORT', pdfErr.message, pdfErr.stack);
            res.status(500).json({ error: 'Failed to create PDF' });
        }
    });
};
