module stripe

import "resolver.js" @as str

entity Customer {
    id String @optional,
    object String @optional,
    address Map @optional,
    balance Number @optional,
    created Number @optional,
    currency String @optional,
    default_payment_method String @optional,
    default_source String @optional,
    delinquent Boolean @optional,
    description String @optional,
    discount Map @optional,
    email String @optional,
    invoice_prefix String @optional,
    invoice_settings Map @optional,
    livemode Boolean @optional,
    metadata Map @optional,
    name String @optional,
    next_invoice_sequence Number @optional,
    phone String @optional,
    preferred_locales Any @optional,
    shipping Map @optional,
    tax_exempt String @optional,
    test_clock String @optional
}

entity Product {
    id String @optional,
    object String @optional,
    active Boolean @optional,
    attributes Any @optional,
    created Number @optional,
    default_price String @optional,
    description String @optional,
    images Any @optional,
    livemode Boolean @optional,
    marketing_features Any @optional,
    metadata Map @optional,
    name String @optional,
    package_dimensions Map @optional,
    shippable Boolean @optional,
    statement_descriptor String @optional,
    tax_code String @optional,
    type String @optional,
    unit_label String @optional,
    updated Number @optional,
    url String @optional
}

entity Price {
    id String @optional,
    object String @optional,
    active Boolean @optional,
    billing_scheme String @optional,
    created Number @optional,
    currency String @optional,
    custom_unit_amount Map @optional,
    livemode Boolean @optional,
    lookup_key String @optional,
    metadata Map @optional,
    nickname String @optional,
    product String @optional,
    recurring Map @optional,
    recurring_interval String @optional,
    recurring_interval_count Number @optional,
    tax_behavior String @optional,
    tiers_mode String @optional,
    transform_quantity Map @optional,
    type String @optional,
    unit_amount Number @optional,
    unit_amount_decimal String @optional
}

entity Subscription {
    id String @optional,
    customer String @optional,
    status String @optional,
    collection_method String @optional,
    cancel_at_period_end Boolean @optional,
    current_period_start Number @optional,
    current_period_end Number @optional,
    start_date Number @optional,
    ended_at Number @optional,
    latest_invoice String @optional,
    default_payment_method String @optional,
    description String @optional,
    items Map @optional,
    livemode Boolean @optional,
    metadata Map @optional,
    trial_start Number @optional,
    trial_end Number @optional,
    schedule String @optional
}

entity Invoice {
    id String @optional,
    object String @optional,
    account_country String @optional,
    account_name String @optional,
    account_tax_ids Any @optional,
    amount_due Number @optional,
    amount_overpaid Number @optional,
    amount_paid Number @optional,
    amount_remaining Number @optional,
    amount_shipping Number @optional,
    application String @optional,
    attempt_count Number @optional,
    attempted Boolean @optional,
    auto_advance Boolean @optional,
    automatic_tax Map @optional,
    automatically_finalizes_at Number @optional,
    billing_reason String @optional,
    collection_method String @optional,
    created Number @optional,
    currency String @optional,
    custom_fields Any @optional,
    customer String @optional,
    customer_address Map @optional,
    customer_email String @optional,
    customer_name String @optional,
    customer_phone String @optional,
    customer_shipping Map @optional,
    customer_tax_exempt String @optional,
    customer_tax_ids Any @optional,
    default_payment_method String @optional,
    default_source String @optional,
    default_tax_rates Any @optional,
    description String @optional,
    discounts Any @optional,
    due_date Number @optional,
    effective_at Number @optional,
    ending_balance Number @optional,
    footer String @optional,
    from_invoice String @optional,
    hosted_invoice_url String @optional,
    invoice_pdf String @optional,
    issuer Map @optional,
    last_finalization_error Map @optional,
    latest_revision String @optional,
    lines Map @optional,
    livemode Boolean @optional,
    metadata Map @optional,
    next_payment_attempt Number @optional,
    number String @optional,
    on_behalf_of String @optional,
    parent String @optional,
    payment_settings Map @optional,
    period_end Number @optional,
    period_start Number @optional,
    post_payment_credit_notes_amount Number @optional,
    pre_payment_credit_notes_amount Number @optional,
    receipt_number String @optional,
    rendering Map @optional,
    shipping_cost Map @optional,
    shipping_details Map @optional,
    starting_balance Number @optional,
    statement_descriptor String @optional,
    status String @optional,
    status_transitions Map @optional,
    subtotal Number @optional,
    subtotal_excluding_tax Number @optional,
    test_clock String @optional,
    total Number @optional,
    total_discount_amounts Any @optional,
    total_excluding_tax Number @optional,
    total_pretax_credit_amounts Any @optional,
    total_taxes Any @optional,
    webhooks_delivered_at Number @optional
}

entity PaymentIntent {
    id String @optional,
    object String @optional,
    amount Number @optional,
    amount_capturable Number @optional,
    amount_details Map @optional,
    amount_received Number @optional,
    application String @optional,
    application_fee_amount Number @optional,
    automatic_payment_methods Map @optional,
    canceled_at Number @optional,
    cancellation_reason String @optional,
    capture_method String @optional,
    client_secret String @optional,
    confirmation_method String @optional,
    created Number @optional,
    currency String @optional,
    customer String @optional,
    description String @optional,
    excluded_payment_method_types Any @optional,
    last_payment_error Map @optional,
    latest_charge String @optional,
    livemode Boolean @optional,
    metadata Map @optional,
    next_action Map @optional,
    on_behalf_of String @optional,
    payment_method String @optional,
    payment_method_configuration_details Map @optional,
    payment_method_options Map @optional,
    payment_method_types Any @optional,
    processing Map @optional,
    receipt_email String @optional,
    review String @optional,
    setup_future_usage String @optional,
    shipping Map @optional,
    source String @optional,
    statement_descriptor String @optional,
    statement_descriptor_suffix String @optional,
    status String @optional,
    transfer_data Map @optional,
    transfer_group String @optional
}

entity Charge {
    id String @optional,
    amount Number @optional,
    currency String @optional,
    status String @optional,
    customer String @optional,
    payment_intent String @optional,
    balance_transaction String @optional,
    captured Boolean @optional,
    paid Boolean @optional,
    description String @optional,
    receipt_url String @optional,
    refunded Boolean @optional,
    livemode Boolean @optional,
    created Number @optional,
    metadata Map @optional
}

entity Refund {
    id String @optional,
    amount Number @optional,
    currency String @optional,
    status String @optional,
    charge String @optional,
    payment_intent String @optional,
    reason String @optional,
    receipt_number String @optional,
    description String @optional,
    livemode Boolean @optional,
    created Number @optional,
    metadata Map @optional
}

entity Payout {
    id String @optional,
    amount Number @optional,
    currency String @optional,
    status String @optional,
    arrival_date Number @optional,
    balance_transaction String @optional,
    method String @optional,
    type String @optional,
    description String @optional,
    destination String @optional,
    failure_code String @optional,
    failure_message String @optional,
    livemode Boolean @optional,
    created Number @optional,
    metadata Map @optional
}

entity InvoiceItem {
    id String @optional,
    object String @optional,
    amount Number @optional,
    currency String @optional,
    customer String @optional,
    date Number @optional,
    description String @optional,
    discountable Boolean @optional,
    discounts Any @optional,
    invoice String @optional,
    livemode Boolean @optional,
    metadata Map @optional,
    parent String @optional,
    period Map @optional,
    price String @optional,
    pricing Map @optional,
    proration Boolean @optional,
    quantity Number @optional,
    subscription String @optional,
    subscription_item String @optional,
    tax_rates Any @optional,
    test_clock String @optional,
    unit_amount Number @optional,
    unit_amount_decimal String @optional
}

@public workflow FinalizeInvoice {
    str.finalizeInvoice(FinalizeInvoice.invoice_id)
}

@public workflow SendInvoice {
    str.sendInvoice(SendInvoice.invoice_id)
}

resolver stripe1 [stripe/Customer] {
    create str.createCustomer,
    query str.queryCustomer,
    update str.updateCustomer,
    delete str.deleteCustomer
}

resolver stripe2 [stripe/Product] {
    create str.createProduct,
    query str.queryProduct,
    update str.updateProduct,
    delete str.deleteProduct
}

resolver stripe3 [stripe/Price] {
    create str.createPrice,
    query str.queryPrice,
    update str.updatePrice,
    delete str.deletePrice
}

resolver stripe4 [stripe/Subscription] {
    create str.createSubscription,
    query str.querySubscription,
    update str.updateSubscription,
    delete str.deleteSubscription
}

resolver stripe5 [stripe/Invoice] {
    create str.createInvoice,
    query str.queryInvoice,
    update str.updateInvoice,
    delete str.deleteInvoice
}

resolver stripe6 [stripe/PaymentIntent] {
    create str.createPaymentIntent,
    query str.queryPaymentIntent,
    update str.updatePaymentIntent,
    delete str.deletePaymentIntent
}

resolver stripe7 [stripe/Charge] {
    create str.createCharge,
    query str.queryCharge,
    update str.updateCharge,
    delete str.deleteCharge,
    subscribe str.subsCharges
}

resolver stripe8 [stripe/Refund] {
    create str.createRefund,
    query str.queryRefund,
    update str.updateRefund,
    delete str.deleteRefund
}

resolver stripe9 [stripe/Payout] {
    create str.createPayout,
    query str.queryPayout,
    update str.updatePayout,
    delete str.deletePayout
}

resolver stripe10 [stripe/InvoiceItem] {
    create str.createInvoiceItem,
    query str.queryInvoiceItem,
    update str.updateInvoiceItem,
    delete str.deleteInvoiceItem
}
