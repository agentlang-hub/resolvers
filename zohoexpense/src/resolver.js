import fs from "fs";
import path from "path";
import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";

const al_module = await import(`${process.cwd()}/node_modules/agentlang/out/runtime/module.js`)

const makeInstance = al_module.makeInstance

let accessToken = null;
let tokenExpiry = null;

const toNumber = (value) => value !== undefined && value !== null ? Number(value) : null;
const trimTrailingSlash = (val) => val?.replace(/\/+$/, "") || val;

const getApiBaseUrl = () => trimTrailingSlash(getLocalEnv("ZOHO_EXPENSE_BASE_URL")) || "https://www.zohoapis.com";

const getAccountsBaseUrl = () => {
    return getLocalEnv("ZOHO_EXPENSE_ACCOUNTS_URL") || process.env.ZOHO_EXPENSE_ACCOUNTS_URL || "https://accounts.zoho.com";
};

const getOrganizationId = () => {
    const orgId = getLocalEnv("ZOHO_EXPENSE_ORG_ID") || process.env.ZOHO_EXPENSE_ORG_ID;
    if (!orgId) {
        throw new Error("ZOHO_EXPENSE_ORG_ID is required.");
    }
    return orgId;
};

const getTimeoutMs = () => {
    const val = getLocalEnv("ZOHO_EXPENSE_TIMEOUT_MS") || process.env.ZOHO_EXPENSE_TIMEOUT_MS;
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num : 30000;
};

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch {
            return await response.text();
        }
    } catch (error) {
        console.error("ZOHO EXPENSE RESOLVER: Error reading response body:", error);
        return {};
    }
};

async function exchangeToken(params) {
    const tokenUrl = `${getAccountsBaseUrl()}/oauth/v2/token`;
    console.log(`ZOHO EXPENSE RESOLVER111: requesting token from ${tokenUrl} with grant_type=${params.get("grant_type")}`);

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const body = await getResponseBody(response);
    if (!response.ok) {
        throw new Error(`Zoho token request failed ${response.status}: ${JSON.stringify(body)}`);
    }

    if (!body.access_token) {
        throw new Error(`Zoho token response missing access_token: ${JSON.stringify(body)}`);
    }

    accessToken = body.access_token;
    if (body.expires_in) {
        tokenExpiry = Date.now() + (Number(body.expires_in) - 60) * 1000;
    }

    if (body.refresh_token && !(getLocalEnv("ZOHO_EXPENSE_REFRESH_TOKEN") || process.env.ZOHO_EXPENSE_REFRESH_TOKEN)) {
        console.log("ZOHO EXPENSE RESOLVER: received refresh_token; set ZOHO_EXPENSE_REFRESH_TOKEN to reuse");
    }

    return accessToken;
}

async function getAccessToken() {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const direct = getLocalEnv("ZOHO_EXPENSE_ACCESS_TOKEN") || process.env.ZOHO_EXPENSE_ACCESS_TOKEN;
    if (direct) {
        accessToken = direct;
        tokenExpiry = null;
        return accessToken;
    }

    const clientId = getLocalEnv("ZOHO_EXPENSE_CLIENT_ID") || process.env.ZOHO_EXPENSE_CLIENT_ID;
    const clientSecret = getLocalEnv("ZOHO_EXPENSE_CLIENT_SECRET") || process.env.ZOHO_EXPENSE_CLIENT_SECRET;
    const redirectUri = getLocalEnv("ZOHO_EXPENSE_REDIRECT_URL") || process.env.ZOHO_EXPENSE_REDIRECT_URL;
    const authCode = getLocalEnv("ZOHO_EXPENSE_AUTH_CODE") || process.env.ZOHO_EXPENSE_AUTH_CODE;
    const refreshToken = getLocalEnv("ZOHO_EXPENSE_REFRESH_TOKEN") || process.env.ZOHO_EXPENSE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
        const params = new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token"
        });
        return await exchangeToken(params);
    }

    if (clientId && clientSecret && authCode && redirectUri) {
        const params = new URLSearchParams({
            code: authCode,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
        });
        return await exchangeToken(params);
    }

    throw new Error("Zoho Expense authentication required: set ZOHO_EXPENSE_ACCESS_TOKEN or OAuth2 variables (client id/secret/auth code/redirect).");
}

const asInstance = (entity, entityType) => {
    const instanceMap = new Map(Object.entries(entity));
    return makeInstance("zohoexpense", entityType, instanceMap);
};

const toExpense = (expense) => ({
    id: expense?.expense_id || expense?.id,
    report_id: expense?.report_id || expense?.reportId,
    amount: toNumber(expense?.amount ?? expense?.amount_with_tax ?? expense?.total),
    currency: expense?.currency_code || expense?.currency,
    description: expense?.description || expense?.notes,
    status: expense?.status || expense?.review_status,
    created_time: expense?.created_time || expense?.created_at || expense?.created_date,
    updated_time: expense?.updated_time || expense?.updated_at || expense?.last_modified_time,
    merchant: expense?.merchant || expense?.vendor_name,
    category: expense?.category_name || expense?.category
});

const toReport = (report) => ({
    id: report?.report_id || report?.id,
    report_name: report?.report_name || report?.name,
    status: report?.status || report?.review_status,
    start_date: report?.start_date,
    end_date: report?.end_date
});

const toCurrency = (currency) => ({
    id: currency?.currency_id || currency?.id,
    code: currency?.currency_code || currency?.code,
    name: currency?.currency_name || currency?.name,
    symbol: currency?.currency_symbol || currency?.symbol,
    is_base: currency?.is_base_currency ?? currency?.is_base,
    exchange_rate: toNumber(currency?.exchange_rate ?? currency?.exchangeRate)
});

const toExpenseCategory = (category) => ({
    id: category?.category_id || category?.id,
    name: category?.category_name || category?.name,
    status: category?.status,
    is_active: category?.is_active ?? category?.active,
    type: category?.type || category?.category_type
});

const guessMimeType = (filename) => {
    const ext = (path.extname(filename) || "").toLowerCase();
    switch (ext) {
        case ".pdf":
            return "application/pdf";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".gif":
            return "image/gif";
        case ".heic":
            return "image/heic";
        default:
            return "application/octet-stream";
    }
};

const makeRequest = async (endpoint, options = {}, queryParams = {}) => {
    const token = await getAccessToken();
    const orgId = getOrganizationId();
    const baseApi = getApiBaseUrl();
    const timeoutMs = getTimeoutMs();
    const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;

    const rawUrl = endpoint.startsWith("http") ? endpoint : `${baseApi}/expense/v1${endpoint}`;
    const url = new URL(rawUrl);

    Object.entries(queryParams || {}).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
            url.searchParams.set(key, val);
        }
    });

    // Only set organization_id if endpoint is expenses
    if (!url.searchParams.has("organization_id")) {
        const orgScopedPaths = ["/expenses", "/expensereports", "/expensecategories"];
        if (orgScopedPaths.some((path) => url.pathname.includes(path))) {
            url.searchParams.set("organization_id", orgId);
        }
    }

    const headers = {
        Authorization: `Zoho-oauthtoken ${token}`,
        ...(options.method && options.method !== "GET" && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`ZOHO EXPENSE RESOLVER: Request timeout after ${timeoutMs}ms - ${url.toString()}`);
        controller.abort();
    }, timeoutMs);
    
    try {
        console.log(`ZOHO EXPENSE RESOLVER: ${options.method || "GET"} ${url.toString()}`);

        console.log(`ZOHO EXPENSE RESOLVER: headers ${JSON.stringify(headers)}`);
        console.log(`ZOHO EXPENSE RESOLVER: options ${JSON.stringify(options)}`);
        console.log(`ZOHO EXPENSE RESOLVER: controller ${JSON.stringify(controller)}`);
        
        const response = await fetch(url.toString(), {
            ...options,
            headers,
            signal: controller.signal
        });

        const body = await getResponseBody(response);

        console.log(`ZOHO EXPENSE RESOLVER: response ${response.status} ${response.ok}`, body);
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
        }

        return body;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`ZOHO EXPENSE RESOLVER: request failed for ${url.toString()}`, error);
        throw error;
    }
};

export const queryExpense = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const queryVals = attrs.queryAttributeValues || new Map();

    try {
        let payload;
        if (id) {
            payload = await makeRequest(`/expenses/${id}`, { method: "GET" });
            const expense = payload.expense || payload.data || payload;
            return [asInstance(toExpense(expense), "Expense")];
        }

        const query = {};
        ["status", "employee_id", "report_id", "page", "per_page", "from", "to", "updated_time"].forEach((key) => {
            if (queryVals.get(key)) query[key] = queryVals.get(key);
        });
        payload = await makeRequest("/expenses", { method: "GET" }, query);
        const expenses = payload.expenses || payload.data || [];
        return expenses.map((exp) => asInstance(toExpense(exp), "Expense"));
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to query expenses: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const createExpense = async (env, attributes) => {
    const attrs = attributes.attributes || new Map();
    try {
        const payload = attrs.get("payload") || {};

        const candidateFields = {
            amount: toNumber(attrs.get("amount")),
            currency_id: attrs.get("currency_id"),
            description: attrs.get("description"),
            date: attrs.get("date"),
            merchant: attrs.get("merchant"),
            category_id: attrs.get("category_id"),
            report_id: attrs.get("report_id"),
            reference_number: attrs.get("reference_number"),
            exchange_rate: attrs.get("exchange_rate") ? Number(attrs.get("exchange_rate")) : undefined
        };

        Object.entries(candidateFields).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== "") {
                payload[key] = val;
            }
        });

        const response = await makeRequest("/expenses", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const expenseData = response.expenses[0];
        const mapped = toExpense(expenseData);

        return asInstance(mapped, "Expense");
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to create expense: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const queryReport = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const queryVals = attrs.queryAttributeValues || new Map();

    try {
        const allowedKeys = [
            "report_id",
            "report_name",
            "description",
            "report_number",
            "start_date",
            "end_date",
            "status"
        ];

        if (id) {
            const payload = await makeRequest(`/expensereports/${id}`, { method: "GET" });
            let report = payload.expense_report || payload.data || payload;
            // If allowed keys are present in queryVals, filter the returned report accordingly
            let filtered = {};
            let anyFilter = false;
            allowedKeys.forEach((key) => {
                if (queryVals.get(key)) {
                    anyFilter = true;
                    if (report?.[key] !== undefined) {
                        if (String(report[key]) === String(queryVals.get(key))) {
                            filtered[key] = report[key];
                        }
                    }
                }
            });
            if (anyFilter) {
                // Only include the report if all filter keys match
                const allMatch = Object.keys(filtered).length === Array.from(queryVals.keys()).filter(k => allowedKeys.includes(k) && queryVals.get(k)).length;
                if (allMatch) {
                    // Optionally, return only the filtered keys, or the whole report with original allowed fields minus non-matching
                    // We'll return only the allowed keys (match AL code below)
                    let result = {};
                    allowedKeys.forEach((k) => {
                        if (report?.[k] !== undefined) result[k] = report[k];
                    });
                    return [result];
                } else {
                    return [];
                }
            } else {
                // No extra filter, just return allowed keys
                let result = {};
                allowedKeys.forEach((k) => {
                    if (report?.[k] !== undefined) result[k] = report[k];
                });
                return [result];
            }
        }

        const query = {};
        allowedKeys.forEach((key) => {
            if (queryVals.get(key)) query[key] = queryVals.get(key);
        });

        const payload = await makeRequest("/expensereports", { method: "GET" }, query);
        const reports = payload.expense_reports || payload.data || [];
        return reports.map((r) => {
            // Return only the allowed attributes
            let filtered = {};
            allowedKeys.forEach((k) => {
                if (r?.[k] !== undefined) filtered[k] = r[k];
            });
            return filtered;
        });
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to query reports: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const createReport = async (env, attributes) => {
    const attrs = attributes.attributes || new Map();
    try {
        const payload = attrs.get("payload") || {};

        const candidateFields = {
            report_name: attrs.get("report_name"),
            description: attrs.get("description"),
            start_date: attrs.get("start_date"),
            end_date: attrs.get("end_date"),
        };

        Object.entries(candidateFields).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== "") {
                payload[key] = val;
            }
        });

        const response = await makeRequest("/expensereports", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const reportData = response.expense_report || response.data || response;
        const mapped = toReport(reportData);

        return mapped.id ? asInstance(mapped, "Report") : { result: "success", message: "Report created" };
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to create report: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const addExpenseToReport = async (reportId, expenseId) => {
    try {
        if (!reportId) {
            throw new Error("report_id is required");
        }
        if (!expenseId) {
            throw new Error("expense_id is required");
        }

        const normalizeId = (val) => {
            if (val === undefined || val === null) return null;
            if (typeof val === "string") return val.trim();
            if (typeof val === "number") return String(val);
            if (typeof val === "object" && (val.expense_id || val.id)) return String(val.expense_id || val.id);
            return null;
        };

        // Fetch existing report to collect already linked expenses
        const currentReportPayload = await makeRequest(`/expensereports/${reportId}`, { method: "GET" });
        const currentReport = currentReportPayload.expense_report || currentReportPayload.data || currentReportPayload;
        const existingExpensesRaw = currentReport?.expenses || currentReportPayload?.expenses || [];

        const existingIds = [];
        if (Array.isArray(existingExpensesRaw)) {
            existingExpensesRaw.forEach((item) => {
                const id = normalizeId(item);
                if (id) existingIds.push(id);
            });
        } else if (currentReport?.expense_ids) {
            // Some payloads may expose expense_ids separately
            const idsVal = currentReport.expense_ids;
            const list = Array.isArray(idsVal) ? idsVal : String(idsVal).split(",");
            list.forEach((idVal) => {
                const id = normalizeId(idVal);
                if (id) existingIds.push(id);
            });
        }

        const newId = normalizeId(expenseId);
        const allIds = [newId, ...existingIds].filter(Boolean);
        const dedupedIds = Array.from(new Set(allIds));

        const response = await makeRequest(`/expensereports/${reportId}`, {
            method: "PUT",
            body: JSON.stringify({ expenses: dedupedIds.map((id) => ({ expense_id: id })) })
        });

        const reportData = response.expense_report || response.data || response;
        const mapped = toReport(reportData);

        return mapped.id
            ? asInstance(mapped, "Report")
            : { result: "success", message: "Expense added to report", report_id: reportId };
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to add expenses to report: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const queryCurrency = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const queryVals = attrs.queryAttributeValues || new Map();

    try {
        if (id) {
            const payload = await makeRequest(`/settings/currencies/${id}`, { method: "GET" });
            const currency = payload.currency || payload.data || payload;
            return [asInstance(toCurrency(currency), "Currency")];
        }

        const code = queryVals.get("code");
        if (code) {
            const payload = await makeRequest("/settings/currencies", { method: "GET" }, { currency_code: code });
            const currencies = payload.currencies || payload.data || [];
            const matched = currencies.filter(cur =>
                (cur.currency_code || cur.code) === code
            );
            return matched.map(cur => asInstance(toCurrency(cur), "Currency"));
        }

        const query = {};
        ["page", "per_page"].forEach((key) => {
            if (queryVals.get(key)) query[key] = queryVals.get(key);
        });

        const payload = await makeRequest("/settings/currencies", { method: "GET" }, query);
        const currencies = payload.currencies || payload.data || [];
        return currencies.map((cur) => asInstance(toCurrency(cur), "Currency"));
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to query currencies: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const queryExpenseCategory = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const queryVals = attrs.queryAttributeValues || new Map();

    try {
        if (id) {
            const payload = await makeRequest(`/expensecategories/${id}`, { method: "GET" });
            const category = payload.category || payload.data || payload;
            return [asInstance(toExpenseCategory(category), "ExpenseCategory")];
        }

        const query = {};
        ["status", "page", "per_page"].forEach((key) => {
            if (queryVals.get(key)) query[key] = queryVals.get(key);
        });

        const payload = await makeRequest("/expensecategories", { method: "GET" }, query);
        const categories = payload.expense_accounts || payload.data || [];
        return categories
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to query expense categories: ${error}`);
        return { result: "error", message: error.message };
    }
};

export const createExpenseAttachment = async (env, attributes) => {
    const attrs = attributes.attributes || new Map();
    const expenseId = attrs.get("expense_id")
    const fileName = attrs.get("file_name")
    const filePath = attrs.get("file_path")

    try {
        if (!expenseId) {
            throw new Error("expense_id is required");
        }

        if (!fileName) {
            throw new Error("file_name is required");
        }

        let absolutePath;
        if (filePath) {
            absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), "fs/" + filePath);
        } else if (fileName) {
            absolutePath = path.isAbsolute(fileName) ? fileName : path.join(process.cwd(), "fs/" + fileName);
        } else {
            throw new Error("file_name or file_path is required");
        }

        const stat = await fs.promises.stat(absolutePath);
        if (!stat.isFile()) {
            throw new Error("file_name must point to a file");
        }
        const contentType = attrs.get("content_type") || attrs.get("mime_type") || guessMimeType(fileName);
        const buffer = await fs.promises.readFile(absolutePath);

        const formData = new FormData();
        formData.append("organization_id", getOrganizationId());
        formData.append("attachment", new Blob([buffer], { type: contentType }), fileName);
        const jsonString = JSON.stringify({"expense_id": expenseId});
        formData.append("JSONString", jsonString);

        const payload = await makeRequest(`/expenses/${expenseId}`, {
            method: "PUT",
            body: formData
        });

        const expense = payload.expense || payload.data || payload;
        return asInstance(toExpense(expense), "Expense");
    } catch (error) {
        console.error(`ZOHO EXPENSE RESOLVER: Failed to create expense attachment: ${error}`);
        return { result: "error", message: error.message };
    }
};

