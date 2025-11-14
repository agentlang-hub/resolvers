# Stripe Resolver Documentation

## Overview

The Stripe resolver provides a comprehensive integration with Stripe's payment processing API. It supports full CRUD operations for customers, products, prices, subscriptions, invoices, payment intents, charges, refunds, payouts, and invoice items.

## Configuration

### Environment Variables

Set the following environment variables to configure the Stripe resolver:

```bash
STRIPE_API_KEY=sk_test_...          # Your Stripe API key (required)
STRIPE_BASE_URL=https://api.stripe.com  # Stripe API base URL (optional, defaults to https://api.stripe.com)
STRIPE_API_VERSION=2023-10-16       # Stripe API version (optional)
```

### API Key

You can obtain your Stripe API key from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys).

- **Test mode**: Use keys starting with `sk_test_`
- **Live mode**: Use keys starting with `sk_live_`

## Entities

### Customer

Represents a customer in your Stripe account.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "customer"
- `email` (String) - Customer's email address
- `name` (String) - Customer's full name
- `phone` (String) - Customer's phone number
- `address` (Map) - Billing address
- `balance` (Number) - Current balance in cents
- `currency` (String) - Default currency
- `default_payment_method` (String) - ID of default payment method
- `default_source` (String) - ID of default payment source
- `delinquent` (Boolean) - Whether customer has unpaid invoices
- `description` (String) - Description of the customer
- `discount` (Map) - Active discount information
- `invoice_prefix` (String) - Prefix for invoice numbers
- `invoice_settings` (Map) - Invoice settings
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `next_invoice_sequence` (Number) - Next invoice sequence number
- `preferred_locales` (Any) - Preferred locales array
- `shipping` (Map) - Shipping information
- `tax_exempt` (String) - Tax exemption status
- `test_clock` (String) - Test clock ID
- `created` (Number) - Unix timestamp of creation

**Operations:**
- `create` - Create a new customer
- `query` - Query customers (single by ID or list all)
- `update` - Update customer information
- `delete` - Delete a customer

### Product

Represents a product in your Stripe catalog.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "product"
- `name` (String) - Product name
- `description` (String) - Product description
- `active` (Boolean) - Whether the product is active
- `attributes` (Any) - Product attributes array
- `default_price` (String) - Default price ID
- `images` (Any) - Product images array
- `marketing_features` (Any) - Marketing features array
- `package_dimensions` (Map) - Package dimensions
- `shippable` (Boolean) - Whether the product is shippable
- `statement_descriptor` (String) - Statement descriptor
- `tax_code` (String) - Tax code
- `type` (String) - Product type (e.g., "service", "good")
- `unit_label` (String) - Unit label
- `url` (String) - Product URL
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `created` (Number) - Unix timestamp of creation
- `updated` (Number) - Unix timestamp of last update

**Operations:**
- `create` - Create a new product
- `query` - Query products (single by ID or list all)
- `update` - Update product information
- `delete` - Delete a product

### Price

Represents a price for a product.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "price"
- `product` (String) - Product ID
- `active` (Boolean) - Whether the price is active
- `billing_scheme` (String) - Billing scheme (e.g., "per_unit", "tiered")
- `currency` (String) - Three-letter ISO currency code
- `custom_unit_amount` (Map) - Custom unit amount configuration
- `lookup_key` (String) - Lookup key for the price
- `nickname` (String) - Price nickname
- `recurring` (Map) - Recurring billing information
- `recurring_interval` (String) - Recurring interval (e.g., "month", "year")
- `recurring_interval_count` (Number) - Recurring interval count
- `tax_behavior` (String) - Tax behavior
- `tiers_mode` (String) - Tiers mode for tiered pricing
- `transform_quantity` (Map) - Transform quantity configuration
- `type` (String) - Price type (e.g., "one_time", "recurring")
- `unit_amount` (Number) - Unit amount in cents
- `unit_amount_decimal` (String) - Unit amount as decimal string
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `created` (Number) - Unix timestamp of creation

**Operations:**
- `create` - Create a new price
- `query` - Query prices (single by ID or list all)
- `update` - Update price information
- `delete` - Delete a price

### Subscription

Represents a subscription to a plan.

**Fields:**
- `id` (String) - Unique identifier
- `customer` (String) - Customer ID
- `status` (String) - Subscription status (e.g., "active", "past_due", "canceled")
- `collection_method` (String) - Collection method
- `cancel_at_period_end` (Boolean) - Whether to cancel at period end
- `current_period_start` (Number) - Start of current period (Unix timestamp)
- `current_period_end` (Number) - End of current period (Unix timestamp)
- `start_date` (Number) - Subscription start date (Unix timestamp)
- `ended_at` (Number) - Subscription end date (Unix timestamp)
- `latest_invoice` (String) - Latest invoice ID
- `default_payment_method` (String) - Default payment method ID
- `description` (String) - Subscription description
- `items` (Map) - Subscription items
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `trial_start` (Number) - Trial start date (Unix timestamp)
- `trial_end` (Number) - Trial end date (Unix timestamp)
- `schedule` (String) - Schedule ID

**Operations:**
- `create` - Create a new subscription
- `query` - Query subscriptions (single by ID or list all)
- `update` - Update subscription information
- `delete` - Cancel a subscription

### Invoice

Represents an invoice for a customer.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "invoice"
- `customer` (String) - Customer ID
- `status` (String) - Invoice status (e.g., "draft", "open", "paid", "uncollectible", "void")
- `number` (String) - Invoice number
- `collection_method` (String) - Collection method
- `due_date` (Number) - Due date (Unix timestamp)
- `period_start` (Number) - Period start (Unix timestamp)
- `period_end` (Number) - Period end (Unix timestamp)
- `subtotal` (Number) - Subtotal in cents
- `total` (Number) - Total in cents
- `amount_due` (Number) - Amount due in cents
- `amount_paid` (Number) - Amount paid in cents
- `amount_remaining` (Number) - Amount remaining in cents
- `amount_overpaid` (Number) - Amount overpaid in cents
- `amount_shipping` (Number) - Shipping amount in cents
- `currency` (String) - Three-letter ISO currency code
- `hosted_invoice_url` (String) - URL to hosted invoice page
- `invoice_pdf` (String) - URL to invoice PDF
- `created` (Number) - Unix timestamp of creation
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `account_country` (String) - Account country
- `account_name` (String) - Account name
- `account_tax_ids` (Any) - Account tax IDs
- `application` (String) - Application ID
- `attempt_count` (Number) - Payment attempt count
- `attempted` (Boolean) - Whether payment was attempted
- `auto_advance` (Boolean) - Whether invoice auto-advances
- `automatic_tax` (Map) - Automatic tax configuration
- `automatically_finalizes_at` (Number) - Auto-finalization timestamp
- `billing_reason` (String) - Billing reason
- `custom_fields` (Any) - Custom fields
- `customer_address` (Map) - Customer address
- `customer_email` (String) - Customer email
- `customer_name` (String) - Customer name
- `customer_phone` (String) - Customer phone
- `customer_shipping` (Map) - Customer shipping information
- `customer_tax_exempt` (String) - Customer tax exempt status
- `customer_tax_ids` (Any) - Customer tax IDs
- `default_payment_method` (String) - Default payment method ID
- `default_source` (String) - Default source ID
- `default_tax_rates` (Any) - Default tax rates
- `description` (String) - Invoice description
- `discounts` (Any) - Discounts array
- `effective_at` (Number) - Effective date timestamp
- `ending_balance` (Number) - Ending balance
- `footer` (String) - Footer text
- `from_invoice` (String) - Source invoice ID
- `issuer` (Map) - Issuer information
- `last_finalization_error` (Map) - Last finalization error
- `latest_revision` (String) - Latest revision ID
- `lines` (Map) - Invoice line items
- `next_payment_attempt` (Number) - Next payment attempt timestamp
- `on_behalf_of` (String) - On behalf of account ID
- `parent` (String) - Parent invoice ID
- `payment_settings` (Map) - Payment settings
- `post_payment_credit_notes_amount` (Number) - Post-payment credit notes amount
- `pre_payment_credit_notes_amount` (Number) - Pre-payment credit notes amount
- `receipt_number` (String) - Receipt number
- `rendering` (Map) - Rendering configuration
- `shipping_cost` (Map) - Shipping cost
- `shipping_details` (Map) - Shipping details
- `starting_balance` (Number) - Starting balance
- `statement_descriptor` (String) - Statement descriptor
- `status_transitions` (Map) - Status transition information
- `subtotal_excluding_tax` (Number) - Subtotal excluding tax
- `test_clock` (String) - Test clock ID
- `total_discount_amounts` (Any) - Total discount amounts
- `total_excluding_tax` (Number) - Total excluding tax
- `total_pretax_credit_amounts` (Any) - Total pretax credit amounts
- `total_taxes` (Any) - Total taxes
- `webhooks_delivered_at` (Number) - Webhooks delivered timestamp

**Operations:**
- `create` - Create a new invoice
- `query` - Query invoices (single by ID or list all)
- `update` - Update invoice information
- `delete` - Delete an invoice

### PaymentIntent

Represents a payment intent for collecting a payment.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "payment_intent"
- `amount` (Number) - Amount in cents
- `amount_capturable` (Number) - Amount capturable in cents
- `amount_details` (Map) - Amount details
- `amount_received` (Number) - Amount received in cents
- `application` (String) - Application ID
- `application_fee_amount` (Number) - Application fee amount
- `automatic_payment_methods` (Map) - Automatic payment methods configuration
- `canceled_at` (Number) - Canceled timestamp
- `cancellation_reason` (String) - Cancellation reason
- `capture_method` (String) - Capture method
- `client_secret` (String) - Client secret for frontend use
- `confirmation_method` (String) - Confirmation method
- `created` (Number) - Unix timestamp of creation
- `currency` (String) - Three-letter ISO currency code
- `customer` (String) - Customer ID
- `description` (String) - Payment description
- `excluded_payment_method_types` (Any) - Excluded payment method types
- `last_payment_error` (Map) - Last payment error details
- `latest_charge` (String) - Latest charge ID
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `next_action` (Map) - Next action required
- `on_behalf_of` (String) - On behalf of account ID
- `payment_method` (String) - Payment method ID
- `payment_method_configuration_details` (Map) - Payment method configuration details
- `payment_method_options` (Map) - Payment method options
- `payment_method_types` (Any) - Allowed payment method types
- `processing` (Map) - Processing information
- `receipt_email` (String) - Receipt email address
- `review` (String) - Review ID
- `setup_future_usage` (String) - Setup future usage indicator
- `shipping` (Map) - Shipping information
- `source` (String) - Source ID
- `statement_descriptor` (String) - Statement descriptor
- `statement_descriptor_suffix` (String) - Statement descriptor suffix
- `status` (String) - Payment intent status
- `transfer_data` (Map) - Transfer data
- `transfer_group` (String) - Transfer group

**Operations:**
- `create` - Create a new payment intent
- `query` - Query payment intents (single by ID or list all)
- `update` - Update payment intent information
- `delete` - Cancel a payment intent

### Charge

Represents a charge on a customer.

**Fields:**
- `id` (String) - Unique identifier
- `amount` (Number) - Amount in cents
- `currency` (String) - Three-letter ISO currency code
- `status` (String) - Charge status
- `customer` (String) - Customer ID
- `payment_intent` (String) - Payment intent ID
- `balance_transaction` (String) - Balance transaction ID
- `captured` (Boolean) - Whether the charge was captured
- `paid` (Boolean) - Whether the charge was paid
- `description` (String) - Charge description
- `receipt_url` (String) - Receipt URL
- `refunded` (Boolean) - Whether the charge was refunded
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `created` (Number) - Unix timestamp of creation

**Operations:**
- `create` - Create a new charge
- `query` - Query charges (single by ID or list all)
- `update` - Update charge information
- `delete` - Refund a charge
- `subscribe` - Subscribe to charge updates

### Refund

Represents a refund for a charge.

**Fields:**
- `id` (String) - Unique identifier
- `amount` (Number) - Refund amount in cents
- `currency` (String) - Three-letter ISO currency code
- `status` (String) - Refund status
- `charge` (String) - Charge ID
- `payment_intent` (String) - Payment intent ID
- `reason` (String) - Refund reason
- `receipt_number` (String) - Receipt number
- `description` (String) - Refund description
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `created` (Number) - Unix timestamp of creation

**Operations:**
- `create` - Create a new refund
- `query` - Query refunds (single by ID or list all)
- `update` - Update refund information
- `delete` - Cancel a refund

### Payout

Represents a payout to a connected account.

**Fields:**
- `id` (String) - Unique identifier
- `amount` (Number) - Payout amount in cents
- `currency` (String) - Three-letter ISO currency code
- `status` (String) - Payout status
- `arrival_date` (Number) - Arrival date (Unix timestamp)
- `balance_transaction` (String) - Balance transaction ID
- `method` (String) - Payout method
- `type` (String) - Payout type
- `description` (String) - Payout description
- `destination` (String) - Destination account ID
- `failure_code` (String) - Failure code
- `failure_message` (String) - Failure message
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `created` (Number) - Unix timestamp of creation

**Operations:**
- `create` - Create a new payout
- `query` - Query payouts (single by ID or list all)
- `update` - Update payout information
- `delete` - Cancel a payout

### InvoiceItem

Represents an item on an invoice.

**Fields:**
- `id` (String) - Unique identifier
- `object` (String) - Object type, always "invoiceitem"
- `amount` (Number) - Amount in cents
- `currency` (String) - Three-letter ISO currency code
- `customer` (String) - Customer ID
- `date` (Number) - Date (Unix timestamp)
- `description` (String) - Item description
- `discountable` (Boolean) - Whether discounts apply
- `discounts` (Any) - Discounts array
- `invoice` (String) - Invoice ID
- `livemode` (Boolean) - Whether this is a live mode object
- `metadata` (Map) - Key-value pairs for additional data
- `parent` (String) - Parent invoice item ID
- `period` (Map) - Period information
- `price` (String) - Price ID
- `pricing` (Map) - Pricing information
- `proration` (Boolean) - Whether this is a proration
- `quantity` (Number) - Quantity
- `subscription` (String) - Subscription ID
- `subscription_item` (String) - Subscription item ID
- `tax_rates` (Any) - Tax rates array
- `test_clock` (String) - Test clock ID
- `unit_amount` (Number) - Unit amount in cents
- `unit_amount_decimal` (String) - Unit amount as decimal string

**Operations:**
- `create` - Create a new invoice item
- `query` - Query invoice items (single by ID or list all)
- `update` - Update invoice item information
- `delete` - Delete an invoice item

## Workflows

### FinalizeInvoice

Finalizes a draft invoice, making it ready for payment.

**Parameters:**
- `invoice_id` (String) - The ID of the invoice to finalize

**Usage:**
```javascript
await FinalizeInvoice({ invoice_id: "in_1234567890" })
```

### SendInvoice

Sends an invoice to the customer via email.

**Parameters:**
- `invoice_id` (String) - The ID of the invoice to send

**Usage:**
```javascript
await SendInvoice({ invoice_id: "in_1234567890" })
```

## Examples

### Creating a Customer

```javascript
const customer = await createCustomer({
  attributes: new Map([
    ['email', 'customer@example.com'],
    ['name', 'John Doe'],
    ['phone', '+1234567890']
  ])
});
```

### Creating a Product

```javascript
const product = await createProduct({
  attributes: new Map([
    ['name', 'Premium Plan'],
    ['description', 'A premium subscription plan'],
    ['type', 'service']
  ])
});
```

### Creating a Price

```javascript
const price = await createPrice({
  attributes: new Map([
    ['product', 'prod_1234567890'],
    ['currency', 'usd'],
    ['unit_amount', 2000], // $20.00
    ['recurring', { interval: 'month' }]
  ])
});
```

### Creating a Subscription

```javascript
const subscription = await createSubscription({
  attributes: new Map([
    ['customer', 'cus_1234567890'],
    ['items', [{ price: 'price_1234567890' }]]
  ])
});
```

### Creating an Invoice

```javascript
const invoice = await createInvoice({
  attributes: new Map([
    ['customer', 'cus_1234567890'],
    ['collection_method', 'send_invoice'],
    ['days_until_due', 30]
  ])
});
```

### Creating a Payment Intent

```javascript
const paymentIntent = await createPaymentIntent({
  attributes: new Map([
    ['amount', 2000], // $20.00
    ['currency', 'usd'],
    ['customer', 'cus_1234567890'],
    ['payment_method_types', ['card']]
  ])
});
```

### Querying Entities

```javascript
// Query single entity by ID
const customer = await queryCustomer({
  queryAttributeValues: new Map([
    ['__path__', '/customers/cus_1234567890']
  ])
});

// Query all entities
const customers = await queryCustomer({
  queryAttributeValues: new Map()
});
```

### Updating Entities

```javascript
const updatedCustomer = await updateCustomer(
  existingCustomer,
  new Map([
    ['email', 'newemail@example.com'],
    ['name', 'Jane Doe']
  ])
);
```

### Deleting Entities

```javascript
const result = await deleteCustomer(existingCustomer);
// Returns: { result: 'success' }
```

## Error Handling

All operations return a result object with the following structure:

**Success:**
```javascript
{
  result: 'success',
  id: 'entity_id' // For create operations
}
```

**Error:**
```javascript
{
  result: 'error',
  message: 'Error description'
}
```

For query operations, successful results return an array of entity instances.

## Subscriptions

The Charge entity supports real-time subscriptions via the `subscribe` operation:

```javascript
await subsCharges(resolver);
```

This will poll for new charges at regular intervals (configurable via environment variables).

## Notes

- All amounts are in cents (e.g., $20.00 = 2000)
- All timestamps are Unix timestamps (seconds since epoch)
- The `livemode` field indicates whether the object is from test or live mode
- All fields are optional and may be `null` or `undefined`
- Map fields contain nested objects with additional properties
- Array fields may contain complex objects

## API Reference

For detailed API documentation, refer to the [Stripe API Reference](https://stripe.com/docs/api).
