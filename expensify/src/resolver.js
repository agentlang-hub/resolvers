import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";


function toExpense(expense) {
    return {
        id: expense.expenseID || expense.id,
        report_id: expense.reportID || expense.report_id,
        report_name: expense.reportName || expense.report_name,
        merchant: expense.merchant || expense.merchantName,
        amount: expense.amount ? parseFloat(expense.amount) : null,
        currency: expense.currency || 'USD',
        category: expense.category || expense.categoryName,
        created: expense.created || expense.createdDate,
        modified: expense.modified || expense.modifiedDate,
        comment: expense.comment || expense.description,
        receipt: expense.receipt || expense.hasReceipt || false,
        reimbursable: expense.reimbursable !== false,
        billable: expense.billable || false,
        expense_type: expense.expenseType || expense.type,
        tag: expense.tag || expense.tags || null,
        employee_email: expense.employeeEmail || expense.email,
        employee_name: expense.employeeName || expense.name
    };
}

function toReport(report) {
    return {
        id: report.reportID || report.id,
        report_name: report.reportName || report.name,
        status: report.state || report.status,
        total: report.total ? parseFloat(report.total) : null,
        currency: report.currency || 'USD',
        created: report.created || report.createdDate,
        modified: report.modified || report.modifiedDate,
        submitted: report.submitted || report.submittedDate,
        approved: report.approved || report.approvedDate,
        reimbursed: report.reimbursed || report.reimbursedDate,
        employee_email: report.employeeEmail || report.email,
        employee_name: report.employeeName || report.name,
        policy_id: report.policyID || report.policy_id,
        policy_name: report.policyName || report.policy_name,
        expense_count: report.expenseCount || (report.expenses ? report.expenses.length : 0)
    };
}

function toPolicy(policy) {
    return {
        id: policy.policyID || policy.id,
        name: policy.policyName || policy.name,
        output_currency: policy.outputCurrency || policy.currency,
        created: policy.created || policy.createdDate,
        modified: policy.modified || policy.modifiedDate,
        employee_count: policy.employeeCount || 0,
        owner_email: policy.ownerEmail || policy.owner_email
    };
}

function asInstance(entity, entityType) {
    const instanceMap = new Map(Object.entries(entity))
    return makeInstance('expensify', entityType, instanceMap)
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json()
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("EXPENSIFY RESOLVER: Error reading response body:", error);
        return {};
    }
}

// Expensify API base URL
const EXPENSIFY_API_URL = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';

// Get authentication credentials
function getCredentials() {
    const partnerUserID = getLocalEnv("EXPENSIFY_PARTNER_USER_ID");
    const partnerUserSecret = getLocalEnv("EXPENSIFY_PARTNER_USER_SECRET");

    if (!partnerUserID || !partnerUserSecret) {
        throw new Error('Expensify credentials are required: EXPENSIFY_PARTNER_USER_ID and EXPENSIFY_PARTNER_USER_SECRET');
    }

    return {
        partnerUserID,
        partnerUserSecret
    };
}

// Generic HTTP function for Expensify API
const makeRequest = async (requestJobDescription) => {
    const credentials = getCredentials();
    
    const payload = {
        requestJobDescription: {
            ...requestJobDescription,
            credentials: credentials
        }
    };

    const url = EXPENSIFY_API_URL;
    
    console.log(`EXPENSIFY RESOLVER: making http request POST ${url} with job type ${requestJobDescription.type}`)

    const timeoutMs = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`EXPENSIFY RESOLVER: Request timeout after ${timeoutMs}ms - ${url}`);
        controller.abort();
    }, timeoutMs);

    try {
        const formData = new URLSearchParams();
        formData.append('requestJobDescription', JSON.stringify(payload.requestJobDescription));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        console.log(`EXPENSIFY RESOLVER: response ${response.status} ${response.ok}`, body)
    
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`EXPENSIFY RESOLVER: HTTP Error ${response.status} - ${url}`);
            throw new Error(`HTTP Error: ${response.status} - ${JSON.stringify(body)}`);
        }

        // Expensify API returns responses in different formats
        if (body.responseCode === 200 && body.responseObject) {
            return body.responseObject;
        } else if (body.responseCode !== 200) {
            throw new Error(`Expensify API Error: ${body.responseCode} - ${body.responseMessage || JSON.stringify(body)}`);
        }

        return body;

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error(`EXPENSIFY RESOLVER: Request timeout - ${url}`);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
            console.error(`EXPENSIFY RESOLVER: Network unreachable (${error.code}) - ${url}`);
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            console.error(`EXPENSIFY RESOLVER: Connection error (${error.code}) - ${url}`);
        } else {
            console.error(`EXPENSIFY RESOLVER: Request failed (${error.name}) - ${url}`);
        }
        
        throw error;
    }
};

// Expense functions
export const createExpense = async (env, attributes) => {
    try {
        const result = await makeRequest({
            type: 'create',
            inputSettings: {
                type: 'expense',
                employeeEmail: attributes.attributes.get('employee_email'),
                merchant: attributes.attributes.get('merchant'),
                amount: attributes.attributes.get('amount'),
                currency: attributes.attributes.get('currency') || 'USD',
                created: attributes.attributes.get('created') || new Date().toISOString(),
                category: attributes.attributes.get('category'),
                comment: attributes.attributes.get('comment'),
                reportID: attributes.attributes.get('report_id'),
                expenseType: attributes.attributes.get('expense_type'),
                tag: attributes.attributes.get('tag')
            }
        });
        
        // Expensify create returns expense ID
        const expenseId = result.expenseID || result.id;
        return {"result": "success", "id": expenseId};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to create expense: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryExpense = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`EXPENSIFY RESOLVER: Querying Expensify expense: ${id}\n`);
    try {
        let inst;
        if (id) {
            // Query single expense by ID
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'expenses',
                    expenseID: id
                }
            });
            inst = inst.expenses || [inst];
        } else {
            // Query all expenses
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'expenses'
                }
            });
            inst = inst.expenses || [];
        }
        
        if (!(inst instanceof Array)) {
            inst = [inst];
        }
        
        return inst.map((data) => { 
            const mappedData = toExpense(data);
            return asInstance(mappedData, 'Expense');
        });
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to query expenses: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateExpense = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Expense ID is required for update"};
    }

    const data = {
        type: 'update',
        inputSettings: {
            type: 'expense',
            expenseID: id,
            merchant: newAttrs.get('merchant'),
            amount: newAttrs.get('amount'),
            currency: newAttrs.get('currency'),
            category: newAttrs.get('category'),
            comment: newAttrs.get('comment'),
            expenseType: newAttrs.get('expense_type'),
            tag: newAttrs.get('tag')
        }
    };

    try {
        await makeRequest(data);
        return attributes;
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to update expense: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteExpense = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Expense ID is required for deletion"};
    }

    try {
        await makeRequest({
            type: 'delete',
            inputSettings: {
                type: 'expense',
                expenseID: id
            }
        });
        return {"result": "success"};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to delete expense: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Report functions
export const createReport = async (env, attributes) => {
    try {
        const result = await makeRequest({
            type: 'create',
            inputSettings: {
                type: 'report',
                reportName: attributes.attributes.get('report_name'),
                employeeEmail: attributes.attributes.get('employee_email'),
                policyID: attributes.attributes.get('policy_id')
            }
        });
        const reportId = result.reportID || result.id;
        return {"result": "success", "id": reportId};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to create report: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryReport = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`EXPENSIFY RESOLVER: Querying Expensify report: ${id}\n`);
    try {
        let inst;
        if (id) {
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'report',
                    reportID: id
                }
            });
            inst = inst.reports || [inst];
        } else {
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'reports'
                }
            });
            inst = inst.reports || [];
        }
        
        if (!(inst instanceof Array)) {
            inst = [inst];
        }
        
        return inst.map((data) => { 
            const mappedData = toReport(data);
            return asInstance(mappedData, 'Report');
        });
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to query reports: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updateReport = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Report ID is required for update"};
    }

    const data = {
        type: 'update',
        inputSettings: {
            type: 'report',
            reportID: id,
            reportName: newAttrs.get('report_name'),
            policyID: newAttrs.get('policy_id')
        }
    };

    try {
        await makeRequest(data);
        return attributes;
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to update report: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deleteReport = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Report ID is required for deletion"};
    }

    try {
        await makeRequest({
            type: 'delete',
            inputSettings: {
                type: 'report',
                reportID: id
            }
        });
        return {"result": "success"};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to delete report: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Policy functions
export const createPolicy = async (env, attributes) => {
    try {
        const result = await makeRequest({
            type: 'create',
            inputSettings: {
                type: 'policy',
                policyName: attributes.attributes.get('name'),
                outputCurrency: attributes.attributes.get('output_currency') || 'USD',
                ownerEmail: attributes.attributes.get('owner_email')
            }
        });
        const policyId = result.policyID || result.id;
        return {"result": "success", "id": policyId};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to create policy: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const queryPolicy = async (env, attrs) => {
    const id = attrs.queryAttributeValues?.get('__path__')?.split('/')?.pop() ?? null;

    console.log(`EXPENSIFY RESOLVER: Querying Expensify policy: ${id}\n`);
    try {
        let inst;
        if (id) {
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'policy',
                    policyID: id
                }
            });
            inst = inst.policies || [inst];
        } else {
            inst = await makeRequest({
                type: 'get',
                inputSettings: {
                    type: 'policies'
                }
            });
            inst = inst.policies || [];
        }
        
        if (!(inst instanceof Array)) {
            inst = [inst];
        }
        
        return inst.map((data) => { 
            const mappedData = toPolicy(data);
            return asInstance(mappedData, 'Policy');
        });
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to query policies: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const updatePolicy = async (env, attributes, newAttrs) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Policy ID is required for update"};
    }

    const data = {
        type: 'update',
        inputSettings: {
            type: 'policy',
            policyID: id,
            policyName: newAttrs.get('name'),
            outputCurrency: newAttrs.get('output_currency')
        }
    };

    try {
        await makeRequest(data);
        return attributes;
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to update policy: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

export const deletePolicy = async (env, attributes) => {
    const id = attributes.attributes.get('id');
    if (!id) {
        return {"result": "error", "message": "Policy ID is required for deletion"};
    }

    try {
        await makeRequest({
            type: 'delete',
            inputSettings: {
                type: 'policy',
                policyID: id
            }
        });
        return {"result": "success"};
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to delete policy: ${error}`);
        return {"result": "error", "message": error.message};
    }
};

// Subscription functions for real-time updates
async function getAndProcessRecords(resolver, entityType) {
    try {
        let requestJobDescription;
        switch (entityType) {
            case 'expenses':
                requestJobDescription = {
                    type: 'get',
                    inputSettings: {
                        type: 'expenses'
                    }
                };
                break;
            case 'reports':
                requestJobDescription = {
                    type: 'get',
                    inputSettings: {
                        type: 'reports'
                    }
                };
                break;
            case 'policies':
                requestJobDescription = {
                    type: 'get',
                    inputSettings: {
                        type: 'policies'
                    }
                };
                break;
            default:
                console.error(`EXPENSIFY RESOLVER: Unknown entity type: ${entityType}`);
                return;
        }

        const result = await makeRequest(requestJobDescription);
        
        let records = [];
        if (entityType === 'expenses') {
            records = result.expenses || [];
        } else if (entityType === 'reports') {
            records = result.reports || [];
        } else if (entityType === 'policies') {
            records = result.policies || [];
        }
        
        for (let i = 0; i < records.length; ++i) {
            const record = records[i];
            const recordId = record.expenseID || record.reportID || record.policyID || record.id;
            console.log(`EXPENSIFY RESOLVER: Processing ${entityType} ${recordId}`);
            
            const inst = {
                id: recordId,
                type: entityType,
                data: record,
                timestamp: new Date().toISOString()
            };
            
            await resolver.onSubscription(inst, true);
        }
    } catch (error) {
        console.error(`EXPENSIFY RESOLVER: Failed to process ${entityType} records: ${error}`);
    }
}

async function handleSubsExpenses(resolver) {
    console.log('EXPENSIFY RESOLVER: Fetching expenses for subscription...');
    await getAndProcessRecords(resolver, 'expenses');
}

async function handleSubsReports(resolver) {
    console.log('EXPENSIFY RESOLVER: Fetching reports for subscription...');
    await getAndProcessRecords(resolver, 'reports');
}

async function handleSubsPolicies(resolver) {
    console.log('EXPENSIFY RESOLVER: Fetching policies for subscription...');
    await getAndProcessRecords(resolver, 'policies');
}

export async function subsExpenses(resolver) {
    await handleSubsExpenses(resolver);
    const intervalMinutes = parseInt(getLocalEnv("EXPENSIFY_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`EXPENSIFY RESOLVER: Setting expenses polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsExpenses(resolver);
    }, intervalMs);
}

export async function subsReports(resolver) {
    await handleSubsReports(resolver);
    const intervalMinutes = parseInt(getLocalEnv("EXPENSIFY_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`EXPENSIFY RESOLVER: Setting reports polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsReports(resolver);
    }, intervalMs);
}

export async function subsPolicies(resolver) {
    await handleSubsPolicies(resolver);
    const intervalMinutes = parseInt(getLocalEnv("EXPENSIFY_POLL_INTERVAL_MINUTES")) || 15;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`EXPENSIFY RESOLVER: Setting policies polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsPolicies(resolver);
    }, intervalMs);
}

