"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const observability_service_1 = require("../observability.service");
jest.mock('ws', () => ({
    WebSocket: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
    })),
}));
describe('ObservabilityService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [observability_service_1.ObservabilityService],
        }).compile();
        service = module.get(observability_service_1.ObservabilityService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('sendResponseToAgent', () => {
        it('should be a function', () => {
            expect(typeof service.sendResponseToAgent).toBe('function');
        });
        it('should reject on timeout when WebSocket never opens', async () => {
            const mockHookEvent = {
                source_app: 'test-app',
                session_id: 'session-123',
                hook_event_type: 'hitl',
                payload: {},
            };
            const response = {
                response: 'Test response',
                hookEvent: mockHookEvent,
                respondedAt: Date.now(),
            };
            await expect(service.sendResponseToAgent('ws://localhost:9999', response)).rejects.toThrow('Timeout sending response to agent');
        }, 10000);
    });
});
//# sourceMappingURL=observability.service.spec.js.map