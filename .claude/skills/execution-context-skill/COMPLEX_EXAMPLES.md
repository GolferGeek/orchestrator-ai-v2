# ExecutionContext Complex Examples

Advanced examples demonstrating ExecutionContext flow in complex scenarios.

---

## Example 1: Multiple Service Calls in Sequence

**Scenario:** Component calls service A, which calls service B, which calls service C - ExecutionContext must flow through all.

```typescript
// Component
<script setup lang="ts">
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { UserService } from '@/services/user.service';
import { OrderService } from '@/services/order.service';

const executionContextStore = useExecutionContextStore();
const context = executionContextStore.current; // Get from store

const userService = new UserService();
const orderService = new OrderService();

async function createOrderWithUser() {
  // Service A: Get user
  const user = await userService.getUser(context); // ✅ Pass whole context
  
  // Service B: Create order (calls service C internally)
  const order = await orderService.createOrder(context, {
    userId: user.id, // Use from user, but still pass context
    items: [...]
  });
  
  return order;
}
</script>
```

```typescript
// Service A: UserService
export class UserService {
  async getUser(context: ExecutionContext) { // ✅ Receives whole context
    // Make API call with context
    const response = await axios.get(`/api/users/${context.userId}`, {
      headers: {
        'X-Org-Slug': context.orgSlug,
        'Authorization': `Bearer ${token}`
      }
    });
    
    return response.data;
  }
}
```

```typescript
// Service B: OrderService
export class OrderService {
  async createOrder(context: ExecutionContext, data: OrderData) {
    // Service C: Call payment service internally
    const paymentService = new PaymentService();
    const payment = await paymentService.processPayment(context, {
      amount: data.total,
      // ... other payment data
    }); // ✅ Pass whole context to service C
    
    // Create order with context
    const response = await axios.post('/api/orders', {
      ...data,
      paymentId: payment.id
    }, {
      headers: {
        'X-Org-Slug': context.orgSlug,
        'X-Conversation-Id': context.conversationId
      }
    });
    
    return response.data;
  }
}
```

```typescript
// Service C: PaymentService (called by Service B)
export class PaymentService {
  async processPayment(context: ExecutionContext, data: PaymentData) {
    // ✅ Receives whole context from Service B
    // Make payment API call with context
    const response = await axios.post('/api/payments', data, {
      headers: {
        'X-Org-Slug': context.orgSlug,
        'X-Task-Id': context.taskId,
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Log with full context
    await observabilityService.logEvent({
      eventType: 'payment_processed',
      context, // ✅ Pass whole context
      data: response.data
    });
    
    return response.data;
  }
}
```

**Key Points:**
- ✅ ExecutionContext flows through all three services
- ✅ Each service receives whole context, not individual fields
- ✅ Context used for headers, logging, and nested service calls

---

## Example 2: Error Handling with ExecutionContext

**Scenario:** Error occurs in nested service call - ExecutionContext must be included in error handling.

```typescript
// Component
<script setup lang="ts">
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { OrderService } from '@/services/order.service';

const executionContextStore = useExecutionContextStore();
const context = executionContextStore.current;

const orderService = new OrderService();

async function handleOrderCreation() {
  try {
    const order = await orderService.createOrder(context, orderData);
    return order;
  } catch (error) {
    // Error handling with context
    await errorService.logError({
      error,
      context, // ✅ Include context in error logging
      userMessage: 'Failed to create order'
    });
    
    throw error;
  }
}
</script>
```

```typescript
// Service with error handling
export class OrderService {
  async createOrder(context: ExecutionContext, data: OrderData) {
    try {
      // Service call that might fail
      const response = await axios.post('/api/orders', data, {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'X-Conversation-Id': context.conversationId
        }
      });
      
      return response.data;
    } catch (error) {
      // Log error with full context
      await observabilityService.logError({
        eventType: 'order_creation_failed',
        context, // ✅ Pass whole context
        error: error.message,
        data
      });
      
      // Re-throw with context for upstream handling
      throw new OrderCreationError(error.message, context);
    }
  }
}
```

```typescript
// Custom error class with context
export class OrderCreationError extends Error {
  constructor(
    message: string,
    public context: ExecutionContext // ✅ Include context in error
  ) {
    super(message);
    this.name = 'OrderCreationError';
  }
}
```

**Key Points:**
- ✅ ExecutionContext included in error objects
- ✅ Error logging includes full context
- ✅ Context available for error recovery

---

## Example 3: Conditional Service Calls

**Scenario:** Service makes conditional calls based on context - ExecutionContext still flows through all paths.

```typescript
// Service with conditional logic
export class NotificationService {
  async sendNotification(context: ExecutionContext, message: string) {
    // Conditional logic based on context
    if (context.agentType === 'marketing') {
      // Path A: Marketing notifications
      return await this.sendMarketingNotification(context, message);
    } else if (context.agentType === 'support') {
      // Path B: Support notifications
      return await this.sendSupportNotification(context, message);
    } else {
      // Path C: Default notifications
      return await this.sendDefaultNotification(context, message);
    }
  }
  
  private async sendMarketingNotification(context: ExecutionContext, message: string) {
    // ✅ Context flows through all conditional paths
    const response = await axios.post('/api/notifications/marketing', {
      message,
      context // ✅ Include context in payload
    }, {
      headers: {
        'X-Org-Slug': context.orgSlug,
        'X-Conversation-Id': context.conversationId
      }
    });
    
    return response.data;
  }
  
  private async sendSupportNotification(context: ExecutionContext, message: string) {
    // ✅ Context flows through this path too
    const response = await axios.post('/api/notifications/support', {
      message,
      context // ✅ Include context
    }, {
      headers: {
        'X-Org-Slug': context.orgSlug,
        'X-Task-Id': context.taskId
      }
    });
    
    return response.data;
  }
  
  private async sendDefaultNotification(context: ExecutionContext, message: string) {
    // ✅ Context flows through default path
    const response = await axios.post('/api/notifications/default', {
      message,
      context // ✅ Include context
    });
    
    return response.data;
  }
}
```

**Key Points:**
- ✅ ExecutionContext flows through all conditional branches
- ✅ Context used for routing decisions
- ✅ All paths receive whole context

---

## Example 4: Parallel Service Calls

**Scenario:** Component makes multiple parallel service calls - ExecutionContext must be passed to all.

```typescript
// Component making parallel calls
<script setup lang="ts">
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { UserService } from '@/services/user.service';
import { OrderService } from '@/services/order.service';
import { NotificationService } from '@/services/notification.service';

const executionContextStore = useExecutionContextStore();
const context = executionContextStore.current;

const userService = new UserService();
const orderService = new OrderService();
const notificationService = new NotificationService();

async function loadDashboardData() {
  // Parallel calls - all receive same context
  const [user, orders, notifications] = await Promise.all([
    userService.getUser(context), // ✅ Context to call 1
    orderService.getOrders(context), // ✅ Context to call 2
    notificationService.getNotifications(context) // ✅ Context to call 3
  ]);
  
  return { user, orders, notifications };
}
</script>
```

**Key Points:**
- ✅ Same ExecutionContext passed to all parallel calls
- ✅ All calls use context for authentication/authorization
- ✅ Context ensures consistent user/organization context

---

## Example 5: Service with Caching

**Scenario:** Service caches results but still uses ExecutionContext for cache keys and validation.

```typescript
// Service with caching
export class UserService {
  private cache = new Map<string, User>();
  
  async getUser(context: ExecutionContext): Promise<User> {
    // Cache key includes context fields
    const cacheKey = `${context.orgSlug}:${context.userId}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cachedUser = this.cache.get(cacheKey)!;
      
      // Validate cached user matches context
      if (cachedUser.orgSlug === context.orgSlug) {
        return cachedUser;
      }
    }
    
    // Fetch with context
    const response = await axios.get(`/api/users/${context.userId}`, {
      headers: {
        'X-Org-Slug': context.orgSlug, // ✅ Use context for API call
        'Authorization': `Bearer ${token}`
      }
    });
    
    const user = response.data;
    
    // Cache with context-based key
    this.cache.set(cacheKey, user);
    
    return user;
  }
}
```

**Key Points:**
- ✅ Cache keys include context fields
- ✅ Context validates cached data
- ✅ API calls use context even with caching

---

## Example 6: Observability with ExecutionContext

**Scenario:** Service emits observability events - ExecutionContext must be included in all events.

```typescript
// Service with observability
export class OrderService {
  async createOrder(context: ExecutionContext, data: OrderData) {
    // Start event with context
    await observabilityService.emit({
      eventType: 'order_creation_started',
      context, // ✅ Full context in event
      data: { orderData: data }
    });
    
    try {
      const response = await axios.post('/api/orders', data, {
        headers: {
          'X-Org-Slug': context.orgSlug,
          'X-Conversation-Id': context.conversationId,
          'X-Task-Id': context.taskId
        }
      });
      
      // Success event with context
      await observabilityService.emit({
        eventType: 'order_creation_completed',
        context, // ✅ Full context in event
        data: { orderId: response.data.id }
      });
      
      return response.data;
    } catch (error) {
      // Error event with context
      await observabilityService.emit({
        eventType: 'order_creation_failed',
        context, // ✅ Full context in event
        error: error.message
      });
      
      throw error;
    }
  }
}
```

**Key Points:**
- ✅ All observability events include full context
- ✅ Context enables event filtering and correlation
- ✅ Context flows through success and error paths

---

## Related

- `SKILL.md` - Core ExecutionContext principles
- `VIOLATIONS.md` - Common violations and fixes
- `ENFORCEMENT.md` - Enforcement strategies

