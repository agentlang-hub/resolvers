import { getLocalEnv } from "agentlang/out/runtime/auth/defs.js";
import { makeInstance } from "agentlang/out/runtime/module.js";

const DEFAULT_TIMEOUT_MS = 30000;

function toTicket(ticket) {
    console.log("ti", ticket.comment)
    return {
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description || ticket.latest_comment?.body || ticket.comment?.body,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        requester_id: ticket.requester_id,
        assignee_id: ticket.assignee_id,
        organization_id: ticket.organization_id,
        tags: Array.isArray(ticket.tags) ? ticket.tags.join(",") : ticket.tags,
        comment: ticket.comment ? { body: JSON.stringify(ticket.comment) } : undefined,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
    };
}

function toUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        time_zone: user.time_zone,
        locale: user.locale,
        organization_id: user.organization_id,
        active: user.active,
        created_at: user.created_at,
        updated_at: user.updated_at
    };
}

function toOrganization(org) {
    return {
        id: org.id,
        name: org.name,
        details: org.details,
        notes: org.notes,
        group_id: org.group_id,
        shared_tickets: org.shared_tickets,
        shared_comments: org.shared_comments,
        created_at: org.created_at,
        updated_at: org.updated_at
    };
}

function toCategory(category) {
    return {
        id: category.id,
        name: category.name,
        description: category.description,
        position: category.position,
        locale: category.locale,
        created_at: category.created_at,
        updated_at: category.updated_at
    };
}

function toSection(section) {
    return {
        id: section.id,
        name: section.name,
        description: section.description,
        category_id: section.category_id,
        position: section.position,
        locale: section.locale,
        created_at: section.created_at,
        updated_at: section.updated_at
    };
}

function toArticle(article) {
    return {
        id: article.id,
        title: article.title,
        body: article.body,
        locale: article.locale,
        section_id: article.section_id,
        author_id: article.author_id,
        comments_disabled: article.comments_disabled,
        draft: article.draft,
        promoted: article.promoted,
        user_segment_id: article.user_segment_id,
        permission_group_id: article.permission_group_id,
        created_at: article.created_at,
        updated_at: article.updated_at
    };
}

function toUserSegment(segment) {
    const join = (arr) => Array.isArray(arr) ? arr.join(",") : arr;
    return {
        id: segment.id,
        name: segment.name,
        user_type: segment.user_type,
        group_ids: join(segment.group_ids),
        organization_ids: join(segment.organization_ids),
        tags: join(segment.tags),
        or_tags: join(segment.or_tags),
        added_user_ids: join(segment.added_user_ids),
        built_in: segment.built_in,
        created_at: segment.created_at,
        updated_at: segment.updated_at
    };
}

function toPermissionGroup(pg) {
    const join = (arr) => Array.isArray(arr) ? arr.join(",") : arr;
    return {
        id: pg.id,
        name: pg.name,
        publish: join(pg.publish),
        edit: join(pg.edit),
        built_in: pg.built_in,
        created_at: pg.created_at,
        updated_at: pg.updated_at
    };
}

function toComment(comment, ticketId) {
    return {
        id: comment.id,
        ticket_id: ticketId,
        author_id: comment.author_id,
        body: comment.body,
        public: comment.public,
        created_at: comment.created_at
    };
}

function asInstance(entity, entityType) {
    return makeInstance("zendesk", entityType, new Map(Object.entries(entity)));
}

const getResponseBody = async (response) => {
    try {
        try {
            return await response.json();
        } catch (e) {
            return await response.text();
        }
    } catch (error) {
        console.error("ZENDESK RESOLVER: Error reading response body:", error);
        return {};
    }
};

function getZendeskConfig() {
    const subdomain = getLocalEnv("ZENDESK_SUBDOMAIN") || process.env.ZENDESK_SUBDOMAIN;
    const email = getLocalEnv("ZENDESK_EMAIL") || process.env.ZENDESK_EMAIL;
    const apiToken = getLocalEnv("ZENDESK_API_TOKEN") || process.env.ZENDESK_API_TOKEN;

    if (!subdomain || !email || !apiToken) {
        throw new Error("Zendesk credentials required: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN");
    }

    const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
    const authHeader = `Basic ${Buffer.from(`${email}/token:${apiToken}`).toString("base64")}`;

    return { baseUrl, authHeader };
}

async function makeRequest(method, path, payload) {
    const { baseUrl, authHeader } = getZendeskConfig();
    const url = `${baseUrl}${path}`;

    console.log(`ZENDESK RESOLVER: ${method} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: payload ? JSON.stringify(payload) : undefined,
            signal: controller.signal
        });

        const body = await getResponseBody(response);
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`ZENDESK RESOLVER: Error ${response.status}`, body);
            throw new Error(`Zendesk API error ${response.status}: ${JSON.stringify(body)}`);
        }

        return body;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            console.error(`ZENDESK RESOLVER: Request timed out ${url}`);
        } else {
            console.error(`ZENDESK RESOLVER: Request failed ${url}`, error);
        }
        throw error;
    }
}

function normalizeTags(value) {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        return value.split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [String(value)];
}

export const createTicket = async (_env, attributes) => {
    try {
        const tags = normalizeTags(attributes.attributes.get("tags"));
        const ticketPayload = {
            subject: attributes.attributes.get("subject"),
            comment: attributes.attributes.get("description") ? { body: attributes.attributes.get("description") } : undefined,
            status: attributes.attributes.get("status"),
            priority: attributes.attributes.get("priority"),
            type: attributes.attributes.get("type"),
            requester_id: attributes.attributes.get("requester_id"),
            assignee_id: attributes.attributes.get("assignee_id"),
            organization_id: attributes.attributes.get("organization_id"),
            tags
        };

        const result = await makeRequest("POST", "/tickets.json", { ticket: ticketPayload });
        const ticket = result.ticket || result;
        return asInstance(toTicket(ticket), "Ticket");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create ticket", error);
        return { result: "error", message: error.message };
    }
};

export const queryTicket = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;

    try {
        if (id) {
            const result = await makeRequest("GET", `/tickets/${id}.json`);
            const ticket = result.ticket || result;
            return [asInstance(toTicket(ticket), "Ticket")];
        }

        const result = await makeRequest("GET", "/tickets.json?per_page=100");
        const tickets = result.tickets || [];
        return tickets.map((ticket) => asInstance(toTicket(ticket), "Ticket"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query tickets", error);
        return { result: "error", message: error.message };
    }
};

export const updateTicket = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Ticket ID is required for update" };
    }

    const tags = normalizeTags(newAttrs.get("tags"));
    const updates = {};

    console.log("newAttrs", newAttrs.get("comment"))
    if (newAttrs.get("subject") !== undefined) updates.subject = newAttrs.get("subject");
    if (newAttrs.get("description") !== undefined) updates.comment = { body: newAttrs.get("description") };
    if (newAttrs.get("status") !== undefined) updates.status = newAttrs.get("status");
    if (newAttrs.get("priority") !== undefined) updates.priority = newAttrs.get("priority");
    if (newAttrs.get("type") !== undefined) updates.type = newAttrs.get("type");
    if (newAttrs.get("requester_id") !== undefined) updates.requester_id = newAttrs.get("requester_id");
    if (newAttrs.get("assignee_id") !== undefined) updates.assignee_id = newAttrs.get("assignee_id");
    if (newAttrs.get("organization_id") !== undefined) updates.organization_id = newAttrs.get("organization_id");
    if (newAttrs.get("comment") !== undefined) updates.comment = newAttrs.get("comment")
    if (tags !== undefined) updates.tags = tags;

    try {
        await makeRequest("PUT", `/tickets/${id}.json`, { ticket: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update ticket", error);
        return { result: "error", message: error.message };
    }
};

export const deleteTicket = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Ticket ID is required for deletion" };
    }

    try {
        await makeRequest("DELETE", `/tickets/${id}.json`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete ticket", error);
        return { result: "error", message: error.message };
    }
};

// Ticket comments
export const addTicketComment = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("ticket_id");
    const body = newAttrs.get("body");
    const isPublic = newAttrs.get("public");

    if (!id || !body) {
        return { result: "error", message: "Ticket ID and body are required" };
    }

    try {
        const payload = { ticket: { comment: { body, public: isPublic !== false } } };
        await makeRequest("PUT", `/tickets/${id}.json`, payload);
        return asInstance(toComment(comment, id), "TicketComment");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to add ticket comment", error);
        return { result: "error", message: error.message };
    }
};

export const queryTicketComments = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("ticket_id") ?? null;
    if (!id) {
        return { result: "error", message: "Ticket ID is required to list comments" };
    }

    try {
        const result = await makeRequest("GET", `/tickets/${id}/comments.json`);
        const comments = result.comments || [];
        return comments.map((c) => asInstance(toComment(c, id), "TicketComment"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query ticket comments", error);
        return { result: "error", message: error.message };
    }
};

// Users
export const createUser = async (_env, attributes) => {
    try {
        const payload = {
            user: {
                name: attributes.attributes.get("name"),
                email: attributes.attributes.get("email"),
                role: attributes.attributes.get("role") || "end-user",
                organization_id: attributes.attributes.get("organization_id")
            }
        };
        const result = await makeRequest("POST", "/users.json", payload);
        const user = result.user || result;
        return asInstance(toUser(user), "User");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create user", error);
        return { result: "error", message: error.message };
    }
};

export const queryUser = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/users/${id}.json`);
            const user = result.user || result;
            return [asInstance(toUser(user), "User")];
        }
        const result = await makeRequest("GET", "/users.json?per_page=100");
        const users = result.users || [];
        return users.map((u) => asInstance(toUser(u), "User"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query users", error);
        return { result: "error", message: error.message };
    }
};

export const updateUser = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "User ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("name") !== undefined) updates.name = newAttrs.get("name");
    if (newAttrs.get("email") !== undefined) updates.email = newAttrs.get("email");
    if (newAttrs.get("role") !== undefined) updates.role = newAttrs.get("role");
    if (newAttrs.get("organization_id") !== undefined) updates.organization_id = newAttrs.get("organization_id");

    try {
        await makeRequest("PUT", `/users/${id}.json`, { user: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update user", error);
        return { result: "error", message: error.message };
    }
};

export const deleteUser = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "User ID is required for deletion" };
    }

    try {
        await makeRequest("DELETE", `/users/${id}.json`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete user", error);
        return { result: "error", message: error.message };
    }
};

// Organizations
export const createOrganization = async (_env, attributes) => {
    try {
        const payload = {
            organization: {
                name: attributes.attributes.get("name"),
                details: attributes.attributes.get("details"),
                notes: attributes.attributes.get("notes"),
                group_id: attributes.attributes.get("group_id"),
                shared_tickets: attributes.attributes.get("shared_tickets"),
                shared_comments: attributes.attributes.get("shared_comments")
            }
        };
        const result = await makeRequest("POST", "/organizations.json", payload);
        const org = result.organization || result;
        return asInstance(toOrganization(org), "Organization");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create organization", error);
        return { result: "error", message: error.message };
    }
};

export const queryOrganization = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/organizations/${id}.json`);
            const org = result.organization || result;
            return [asInstance(toOrganization(org), "Organization")];
        }
        const result = await makeRequest("GET", "/organizations.json?per_page=100");
        const orgs = result.organizations || [];
        return orgs.map((o) => asInstance(toOrganization(o), "Organization"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query organizations", error);
        return { result: "error", message: error.message };
    }
};

export const updateOrganization = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Organization ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("name") !== undefined) updates.name = newAttrs.get("name");
    if (newAttrs.get("details") !== undefined) updates.details = newAttrs.get("details");
    if (newAttrs.get("notes") !== undefined) updates.notes = newAttrs.get("notes");
    if (newAttrs.get("group_id") !== undefined) updates.group_id = newAttrs.get("group_id");
    if (newAttrs.get("shared_tickets") !== undefined) updates.shared_tickets = newAttrs.get("shared_tickets");
    if (newAttrs.get("shared_comments") !== undefined) updates.shared_comments = newAttrs.get("shared_comments");

    try {
        await makeRequest("PUT", `/organizations/${id}.json`, { organization: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update organization", error);
        return { result: "error", message: error.message };
    }
};

export const deleteOrganization = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Organization ID is required for deletion" };
    }

    try {
        await makeRequest("DELETE", `/organizations/${id}.json`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete organization", error);
        return { result: "error", message: error.message };
    }
};

// Help Center - Categories
export const createCategory = async (_env, attributes) => {
    try {
        const payload = {
            category: {
                name: attributes.attributes.get("name"),
                description: attributes.attributes.get("description"),
                locale: attributes.attributes.get("locale")
            }
        };
        const result = await makeRequest("POST", "/help_center/categories.json", payload);
        const category = result.category || result;
        return asInstance(toCategory(category), "Category");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create category", error);
        return { result: "error", message: error.message };
    }
};

export const queryCategory = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/help_center/categories/${id}.json`);
            const category = result.category || result;
            return [asInstance(toCategory(category), "Category")];
        }
        const result = await makeRequest("GET", "/help_center/categories.json?page[size]=100");
        const categories = result.categories || [];
        return categories.map((c) => asInstance(toCategory(c), "Category"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query categories", error);
        return { result: "error", message: error.message };
    }
};

export const updateCategory = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Category ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("name") !== undefined) updates.name = newAttrs.get("name");
    if (newAttrs.get("description") !== undefined) updates.description = newAttrs.get("description");
    if (newAttrs.get("locale") !== undefined) updates.locale = newAttrs.get("locale");

    try {
        await makeRequest("PUT", `/help_center/categories/${id}.json`, { category: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update category", error);
        return { result: "error", message: error.message };
    }
};

export const deleteCategory = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Category ID is required for deletion" };
    }

    try {
        await makeRequest("DELETE", `/help_center/categories/${id}.json`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete category", error);
        return { result: "error", message: error.message };
    }
};

// Help Center - Sections
export const createSection = async (_env, attributes) => {
    try {
        const payload = {
            section: {
                name: attributes.attributes.get("name"),
                description: attributes.attributes.get("description"),
                category_id: attributes.attributes.get("category_id"),
                locale: attributes.attributes.get("locale")
            }
        };
        if (!attributes.attributes.get("category_id")) {
            return { result: "error", message: "Category ID is required to create a section" };
        }
        const result = await makeRequest("POST", `/help_center/categories/${attributes.attributes.get("category_id")}/sections`, payload);
        const section = result.section || result;
        return asInstance(toSection(section), "Section");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create section", error);
        return { result: "error", message: error.message };
    }
};

export const querySection = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/help_center/sections/${id}.json`);
            const section = result.section || result;
            return [asInstance(toSection(section), "Section")];
        }
        const result = await makeRequest("GET", "/help_center/sections.json?page[size]=100");
        const sections = result.sections || [];
        return sections.map((s) => asInstance(toSection(s), "Section"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query sections", error);
        return { result: "error", message: error.message };
    }
};

export const updateSection = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Section ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("name") !== undefined) updates.name = newAttrs.get("name");
    if (newAttrs.get("description") !== undefined) updates.description = newAttrs.get("description");
    if (newAttrs.get("category_id") !== undefined) updates.category_id = newAttrs.get("category_id");
    if (newAttrs.get("locale") !== undefined) updates.locale = newAttrs.get("locale");

    try {
        if (!attributes.attributes.get("category_id")) {
            return { result: "error", message: "Category ID is required to update a section" };
        }
        await makeRequest("PUT", `/help_center/categories/${attributes.attributes.get("category_id")}/sections/${id}`, { section: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update section", error);
        return { result: "error", message: error.message };
    }
};

export const deleteSection = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Section ID is required for deletion" };
    }

    try {
        if (!attributes.attributes.get("category_id")) {
            return { result: "error", message: "Category ID is required to delete a section" };
        }
        await makeRequest("DELETE", `/help_center/categories/${attributes.attributes.get("category_id")}/sections/${id}`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete section", error);
        return { result: "error", message: error.message };
    }
};

// Help Center - Articles
export const createArticle = async (_env, attributes) => {
    try {
        const payload = {
            article: {
                title: attributes.attributes.get("title"),
                body: attributes.attributes.get("body"),
                locale: attributes.attributes.get("locale"),
                section_id: attributes.attributes.get("section_id"),
                author_id: attributes.attributes.get("author_id"),
                user_segment_id: attributes.attributes.get("user_segment_id"),
                permission_group_id: attributes.attributes.get("permission_group_id"),
                comments_disabled: attributes.attributes.get("comments_disabled"),
                draft: attributes.attributes.get("draft")
            }
        };
        if (!attributes.attributes.get("section_id")) {
            return { result: "error", message: "Section ID is required to create an article" };
        }
        const result = await makeRequest("POST", `/help_center/sections/${attributes.attributes.get("section_id")}/articles`, payload);
        const article = result.article || result;
        return asInstance(toArticle(article), "Article");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create article", error);
        return { result: "error", message: error.message };
    }
};

export const queryArticle = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const sectionId = attrs.queryAttributeValues?.get("section_id");
    try {
        if (id) {
            const result = await makeRequest("GET", `/help_center/articles/${id}.json`);
            const article = result.article || result;
            return [asInstance(toArticle(article), "Article")];
        }

        let path = "/help_center/articles.json?page[size]=100";
        if (sectionId) {
            path = `/help_center/sections/${sectionId}/articles.json?page[size]=100`;
        }
        const result = await makeRequest("GET", path);
        const articles = result.articles || [];
        return articles.map((a) => asInstance(toArticle(a), "Article"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query articles", error);
        return { result: "error", message: error.message };
    }
};

export const updateArticle = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Article ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("title") !== undefined) updates.title = newAttrs.get("title");
    if (newAttrs.get("body") !== undefined) updates.body = newAttrs.get("body");
    if (newAttrs.get("locale") !== undefined) updates.locale = newAttrs.get("locale");
    if (newAttrs.get("section_id") !== undefined) updates.section_id = newAttrs.get("section_id");
    if (newAttrs.get("author_id") !== undefined) updates.author_id = newAttrs.get("author_id");
    if (newAttrs.get("user_segment_id") !== undefined) updates.user_segment_id = newAttrs.get("user_segment_id");
    if (newAttrs.get("permission_group_id") !== undefined) updates.permission_group_id = newAttrs.get("permission_group_id");
    if (newAttrs.get("comments_disabled") !== undefined) updates.comments_disabled = newAttrs.get("comments_disabled");
    if (newAttrs.get("draft") !== undefined) updates.draft = newAttrs.get("draft");

    try {
        if (!attributes.attributes.get("section_id")) {
            return { result: "error", message: "Section ID is required to update an article" };
        }
        await makeRequest("PUT", `/help_center/sections/${attributes.attributes.get("section_id")}/articles/${id}`, { article: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update article", error);
        return { result: "error", message: error.message };
    }
};

export const deleteArticle = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Article ID is required for deletion" };
    }

    try {
        if (!attributes.attributes.get("section_id")) {
            return { result: "error", message: "Section ID is required to delete an article" };
        }
        await makeRequest("DELETE", `/help_center/sections/${attributes.attributes.get("section_id")}/articles/${id}`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete article", error);
        return { result: "error", message: error.message };
    }
};

async function fetchAndEmitTickets(resolver) {
    try {
        const result = await makeRequest("GET", "/tickets.json?per_page=50&sort_by=updated_at&sort_order=desc");
        const tickets = result.tickets || [];

        for (const ticket of tickets) {
            await resolver.onSubscription(
                {
                    id: ticket.id,
                    type: "ticket",
                    data: ticket,
                    timestamp: new Date().toISOString()
                },
                true
            );
        }
    } catch (error) {
        console.error("ZENDESK RESOLVER: Subscription polling failed", error);
    }
}

export async function subsTickets(resolver) {
    await fetchAndEmitTickets(resolver);
    const intervalMinutes = parseInt(getLocalEnv("ZENDESK_POLL_INTERVAL_MINUTES")) || 10;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`ZENDESK RESOLVER: Polling tickets every ${intervalMinutes} minute(s)`);

    setInterval(async () => {
        await fetchAndEmitTickets(resolver);
    }, intervalMs);
}

// Help Center - User Segments
function normalizeIdList(value) {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
    if (typeof value === "string") {
        return value.split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
    }
    return [Number(value)].filter((v) => !Number.isNaN(v));
}

export const queryUserSegment = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    const builtIn = attrs.queryAttributeValues?.get("built_in");
    try {
        if (id) {
            const result = await makeRequest("GET", `/help_center/user_segments/${id}.json`);
            const segment = result.user_segment || result;
            return [asInstance(toUserSegment(segment), "UserSegment")];
        }
        const query = builtIn !== undefined ? `?built_in=${builtIn}` : "?page[size]=100";
        const result = await makeRequest("GET", `/help_center/user_segments${query}`);
        const segments = result.user_segments || [];
        return segments.map((s) => asInstance(toUserSegment(s), "UserSegment"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query user segments", error);
        return { result: "error", message: error.message };
    }
};

// Help Center - Permission Groups
export const createPermissionGroup = async (_env, attributes) => {
    try {
        const payload = {
            permission_group: {
                name: attributes.attributes.get("name"),
                publish: normalizeIdList(attributes.attributes.get("publish")),
                edit: normalizeIdList(attributes.attributes.get("edit"))
            }
        };
        const result = await makeRequest("POST", "/guide/permission_groups.json", payload);
        const pg = result.permission_group || result;
        return asInstance(toPermissionGroup(pg), "PermissionGroup");
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to create permission group", error);
        return { result: "error", message: error.message };
    }
};

export const queryPermissionGroup = async (_env, attrs) => {
    const id = attrs.queryAttributeValues?.get("__path__")?.split("/")?.pop() ?? null;
    try {
        if (id) {
            const result = await makeRequest("GET", `/guide/permission_groups/${id}.json`);
            const pg = result.permission_group || result;
            return [asInstance(toPermissionGroup(pg), "PermissionGroup")];
        }
        const result = await makeRequest("GET", "/guide/permission_groups.json?page[size]=100");
        const groups = result.permission_groups || [];
        return groups.map((g) => asInstance(toPermissionGroup(g), "PermissionGroup"));
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to query permission groups", error);
        return { result: "error", message: error.message };
    }
};

export const updatePermissionGroup = async (_env, attributes, newAttrs) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Permission group ID is required for update" };
    }

    const updates = {};
    if (newAttrs.get("name") !== undefined) updates.name = newAttrs.get("name");
    const publishIds = normalizeIdList(newAttrs.get("publish"));
    const editIds = normalizeIdList(newAttrs.get("edit"));
    if (publishIds !== undefined) updates.publish = publishIds;
    if (editIds !== undefined) updates.edit = editIds;

    try {
        await makeRequest("PUT", `/guide/permission_groups/${id}.json`, { permission_group: updates });
        return attributes;
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to update permission group", error);
        return { result: "error", message: error.message };
    }
};

export const deletePermissionGroup = async (_env, attributes) => {
    const id = attributes.attributes.get("id");
    if (!id) {
        return { result: "error", message: "Permission group ID is required for deletion" };
    }

    try {
        await makeRequest("DELETE", `/guide/permission_groups/${id}.json`);
        return { result: "success" };
    } catch (error) {
        console.error("ZENDESK RESOLVER: Failed to delete permission group", error);
        return { result: "error", message: error.message };
    }
};
