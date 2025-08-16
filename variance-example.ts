// Sistema de data processing con generics avanzados y variance

import { create } from "domain";

// Base types para demonstration
interface Entity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

interface User extends Entity {
    email: string;
    name: string;
    role: 'admin' | 'user';
}

interface Product extends Entity {
    name: string;
    price: number;
    category: string;
}

interface Order extends Entity {
    userId: string;
    productIds: string[];
    total: number;
    status: 'pending' | 'completed' | 'cancelled';
}

// Generic processor con variance
interface DataProcessor<T> {
    process(data: T[]): Promise<ProcessingResult<T>>;
    validate(item: T): ValidationResult;
    transform<U>(data: T[], transformer: (item: T) => U): U[];
}

interface ProcessingResult<T> {
    processed: T[];
    errors: ProcessingError<T>[];
    summary: ProcessingSummary;
}

interface ProcessingError<T> {
    item: T;
    error: string;
    code: string;
}

interface ProcessingSummary {
    total: number;
    successful: number;
    failed: number;
    duration: number;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

// Generic implementation con constraints
class BaseDataProcessor<T extends Entity> implements DataProcessor<T> {
    constructor(
        private validator: (item: T) => ValidationResult,
        private businessRules: BusinessRule<T>[] = []
    ) { }

    async process(data: T[]): Promise<ProcessingResult<T>> {
        const startTime = Date.now();
        const processed: T[] = [];
        const errors: ProcessingError<T>[] = [];

        for (const item of data) {
            try {
                // Validate item
                const validation = this.validate(item);
                if (!validation.isValid) {
                    errors.push({
                        item,
                        error: validation.errors.join(', '),
                        code: 'VALIDATION_ERROR'
                    });
                    continue;
                }

                // Apply business rules
                const processedItem = await this.applyBusinessRules(item);
                processed.push(processedItem);

            } catch (error) {
                errors.push({
                    item,
                    error: (error as Error).message,
                    code: 'PROCESSING_ERROR'
                });
            }
        }

        const duration = Date.now() - startTime;

        return {
            processed,
            errors,
            summary: {
                total: data.length,
                successful: processed.length,
                failed: errors.length,
                duration
            }
        };
    }

    validate(item: T): ValidationResult {
        const errors: string[] = [];

        // Basic entity validation
        if (!item.id) errors.push('ID is required');
        if (!item.createdAt) errors.push('Created date is required');
        if (!item.updatedAt) errors.push('Updated date is required');

        // Custom validation
        const customValidation = this.validator(item);
        if (!customValidation.isValid) {
            errors.push(...customValidation.errors);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    transform<U>(data: T[], transformer: (item: T) => U): U[] {
        return data.map(transformer);
    }

    private async applyBusinessRules(item: T): Promise<T> {
        let processedItem = { ...item };

        for (const rule of this.businessRules) {
            processedItem = await rule.apply(processedItem);
        }

        return processedItem;
    }
}

// Business rule interface
interface BusinessRule<T> {
    name: string;
    apply(item: T): Promise<T>;
}

// Specific processors con type safety
class UserProcessor extends BaseDataProcessor<User> {
    constructor() {
        super(
            (user: User) => ({
                isValid: user.email.includes('@') && user.name.length > 0,
                errors: [
                    ...(user.email.includes('@') ? [] : ['Invalid email format']),
                    ...(user.name.length > 0 ? [] : ['Name is required'])
                ]
            }),
            [
                {
                    name: 'normalizeEmail',
                    async apply(user: User): Promise<User> {
                        return {
                            ...user,
                            email: user.email.toLowerCase().trim()
                        };
                    }
                },
                {
                    name: 'updateTimestamp',
                    async apply(user: User): Promise<User> {
                        return {
                            ...user,
                            updatedAt: new Date()
                        };
                    }
                }
            ]
        );
    }
}

class ProductProcessor extends BaseDataProcessor<Product> {
    constructor() {
        super(
            (product: Product) => ({
                isValid: product.price > 0 && product.name.length > 0,
                errors: [
                    ...(product.price > 0 ? [] : ['Price must be positive']),
                    ...(product.name.length > 0 ? [] : ['Name is required'])
                ]
            }),
            [
                {
                    name: 'normalizeName',
                    async apply(product: Product): Promise<Product> {
                        return {
                            ...product,
                            name: product.name.trim()
                        };
                    }
                },
                {
                    name: 'roundPrice',
                    async apply(product: Product): Promise<Product> {
                        return {
                            ...product,
                            price: Math.round(product.price * 100) / 100
                        };
                    }
                }
            ]
        );
    }
}

// Generic factory con constraints
class ProcessorFactory {
    static createProcessor<T extends Entity>(
        type: Function,
        customValidator?: (item: T) => ValidationResult,
        customRules?: BusinessRule<T>[]
    ): DataProcessor<T> {
        if (type === UserProcessor) {
            return new UserProcessor() as unknown as DataProcessor<T>;
        } else if (type === ProductProcessor) {
            return new ProductProcessor() as unknown as DataProcessor<T>;
        } else {
            return new BaseDataProcessor<T>(
                customValidator || (() => ({ isValid: true, errors: [] })),
                customRules || []
            );
        }
    }
}

// Event processing con variance
type BaseEvent = {
    id: string;
    eventType: string;
}
interface userLoginEvent extends BaseEvent {
    eventType: 'userLogin';
    userId: string;
    timestamp: Date;
}

interface productAddedEvent extends BaseEvent {
    eventType: 'productAdded';
    productId: string;
    quantity: number;
    timestamp: Date;
}

type EventValidator<T extends BaseEvent> = (event: T) => ValidationResult;
type EventRule<T extends BaseEvent> = (event: T) => Promise<T>;

function createEventProcessor<T extends BaseEvent>(
    validator: EventValidator<T>,
): DataProcessor<T> {
    return {
        async process(data: T[]): Promise<ProcessingResult<T>> {
            const startTime = Date.now();
            const processed: T[] = [];
            const errors: ProcessingError<T>[] = [];

            for (const item of data) {
                try {
                    // Validate item
                    const validation = validator(item);
                    if (!validation.isValid) {
                        errors.push({
                            item,
                            error: validation.errors.join(', '),
                            code: 'VALIDATION_ERROR'
                        });
                        continue;
                    }

                    // Apply rules
                    let processedItem = item;

                    processed.push(processedItem);

                } catch (error) {
                    errors.push({
                        item,
                        error: (error as Error).message,
                        code: 'PROCESSING_ERROR'
                    });
                }
            }

            const duration = Date.now() - startTime;

            return {
                processed,
                errors,
                summary: {
                    total: data.length,
                    successful: processed.length,
                    failed: errors.length,
                    duration
                }
            };
        },
        validate(item: T): ValidationResult {
            const errors: string[] = [];

            // Basic event validation
            if (!item.id) errors.push('ID is required');
            if (!item.eventType) errors.push('Event type is required');

            // Custom validation
            const customValidation = validator(item);
            if (!customValidation.isValid) {
                errors.push(...customValidation.errors);
            }

            return {
                isValid: errors.length === 0,
                errors
            };
        },
        transform: function <U>(data: T[], transformer: (item: T) => U): U[] {
            return data.map(transformer);
        }
    }
}
const userLoginValidator: EventValidator<userLoginEvent> = (event) => {
    const errors: string[] = [];
    if (!event.userId) errors.push('User ID is required');
    if (!event.timestamp) errors.push('Timestamp is required');
    return {
        isValid: errors.length === 0,
        errors
    };
}
const productAddedValidator: EventValidator<productAddedEvent> = (event) => {
    const errors: string[] = [];
    if (!event.productId) errors.push('Product ID is required');
    if (event.quantity <= 0) errors.push('Quantity must be positive');
    return {
        isValid: errors.length === 0,
        errors
    };
}
const userLoginProcessor = createEventProcessor(userLoginValidator);
const productAddProcessor = createEventProcessor(productAddedValidator);

const genericEventProcessor = createEventProcessor<BaseEvent>(
    event => ({ isValid: !!event.id && !!event.eventType, errors: [] })
);


// Usage con complete type safety
async function demonstrateGenericProcessing() {
// Event processing
    const loginEvents: userLoginEvent[] = [
        { id: '1', eventType: 'userLogin', userId: 'user1', timestamp: new Date() },
        { id: '2', eventType: 'userLogin', userId: '', timestamp: new Date() }
    ];
    const addProductEvents: productAddedEvent[] = [
        { id: '1', eventType: 'productAdded', productId: 'prod1', quantity: 2, timestamp: new Date() },
        { id: '2', eventType: 'productAdded', productId: '', quantity: -1, timestamp: new Date() }
    ];
    
    const loginResult = await userLoginProcessor.process(loginEvents);

    console.log('User login processing result:', loginResult);

    const productAddResult = await productAddProcessor.process(addProductEvents);

    console.log('Product added processing result:', productAddResult);

    const genericEvents: BaseEvent[] = [
        ...loginEvents,
        ...addProductEvents
    ];
    
    const genericResult = await genericEventProcessor.process(genericEvents);
    
    console.log('Generic event processing result:', genericResult);

    // generic Transformations example
    const summaries = genericEventProcessor.transform(genericEvents, event => ({
        id: event.id,   
        type: event.eventType
    }));
    console.log('Event summaries:', summaries);

    // User processing
    const userProcessor = ProcessorFactory.createProcessor<User>(UserProcessor);
    const users: User[] = [
        {
            id: 'user1',
            email: 'JOHN@EXAMPLE.COM',
            name: 'John Doe',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 'user2',
            email: 'invalid-email',
            name: '',
            role: 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    const userResult = await userProcessor.process(users);
    console.log('User processing result:', userResult);

    // Product processing
    const productProcessor = ProcessorFactory.createProcessor<Product>(ProductProcessor);
    const products: Product[] = [
        {
            id: 'product1',
            name: '  Laptop  ',
            price: 999.999,
            category: 'Electronics',
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: 'product2',
            name: '',
            price: -100,
            category: 'Invalid',
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    const productResult = await productProcessor.process(products);
    console.log('Product processing result:', productResult);

    // Generic transformations
    const userSummaries = userProcessor.transform(users, user => ({
        id: user.id,
        displayName: user.name,
        isAdmin: user.role === 'admin'
    }));

    console.log('User summaries:', userSummaries);
}

demonstrateGenericProcessing();