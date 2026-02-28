import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const isApply = args.includes('--apply');

console.log('--- i18n Injector Tool ---');
if (!isApply) {
    console.log('[DRY-RUN MODE] Files will NOT be modified. Use --apply to execute.');
} else {
    console.log('[APPLY MODE] Committing changes to file system.');
}

const locales = ['zh', 'en', 'vi'];

const projectDetailTrans = {
    zh: {
        navOverview: "总览 (Overview)",
        navBuilds: "构建版本 (Builds)",
        navEvidence: "取证大厅 (Evidence)",
        ctaOpenStudio: "进入工作台 (Studio)",
        ctaImportNovel: "导入小说样本",
        ctaExportEvidence: "导出完整审计凭证",
        ctaExportCsv: "导出 CSV 详单",
        statsBuilds: "构建版本总数",
        statsAudited: "特征审计状态",
        statsUpdated: "最近时间锚点",
        sectionRecentBuilds: "近期产出实例",
        sectionAuditMetering: "审计与计费态势"
    },
    en: {
        navOverview: "Overview",
        navBuilds: "Builds",
        navEvidence: "Evidence",
        ctaOpenStudio: "Open Studio",
        ctaImportNovel: "Import Novel",
        ctaExportEvidence: "Export Evidence Suite",
        ctaExportCsv: "Export CSV",
        statsBuilds: "Total Builds",
        statsAudited: "Audit Status",
        statsUpdated: "Last Updated",
        sectionRecentBuilds: "Recent Builds",
        sectionAuditMetering: "Audit & Metering"
    },
    vi: {
        navOverview: "Tổng quan",
        navBuilds: "Các bản dựng",
        navEvidence: "Bằng chứng",
        ctaOpenStudio: "Vào Bàn Làm Việc",
        ctaImportNovel: "Nhập tiểu thuyết",
        ctaExportEvidence: "Xuất bộ Bằng chứng",
        ctaExportCsv: "Xuất dữ liệu CSV",
        statsBuilds: "Tổng Số Bản Dựng",
        statsAudited: "Trạng thái Kiểm toán",
        statsUpdated: "Cập nhật Lần cuối",
        sectionRecentBuilds: "Cài đặt Gần đây",
        sectionAuditMetering: "Kiểm toán & Thanh toán"
    }
};

const commonTrans = {
    zh: {
        loading: "系统正在读取终端源...",
        retry: "请求超时，重试",
        empty: "当前时区暂无记录"
    },
    en: {
        loading: "Loading system resources...",
        retry: "Retry connection",
        empty: "No records found in this sector"
    },
    vi: {
        loading: "Đang tải tài nguyên hệ thống...",
        retry: "Thử lại kết nối",
        empty: "Không tìm thấy hồ sơ nào"
    }
};

for (const loc of locales) {
    const p = path.join(process.cwd(), `apps/web/src/messages/${loc}.json`);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        data = {};
    }

    let stats = { added: 0, modified: 0, identical: 0 };

    const toInject = {
        ProjectDetail: projectDetailTrans[loc],
        Common: commonTrans[loc]
    };

    for (const [ns, content] of Object.entries(toInject)) {
        if (!data[ns]) {
            data[ns] = {};
        }
        for (const [k, v] of Object.entries(content)) {
            if (data[ns][k] === undefined) {
                stats.added++;
            } else if (data[ns][k] !== v) {
                stats.modified++;
            } else {
                stats.identical++;
            }
            data[ns][k] = v; // Overwrite policy for duplicate keys
        }
    }

    console.log(`[${loc.toUpperCase()}] Summary -> +${stats.added} added | ~${stats.modified} modified | =${stats.identical} unchanged`);
    console.log(`[${loc.toUpperCase()}] Duplicate key policy: OVERRIDE with injected content.`);

    if (isApply) {
        fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
        console.log(`✅ successfully injected to ${loc}.json and deduplicated keys`);
    }
}
