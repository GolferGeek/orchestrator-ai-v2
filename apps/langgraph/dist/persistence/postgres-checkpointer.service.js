"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PostgresCheckpointerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresCheckpointerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const langgraph_checkpoint_postgres_1 = require("@langchain/langgraph-checkpoint-postgres");
const pg_1 = require("pg");
let PostgresCheckpointerService = PostgresCheckpointerService_1 = class PostgresCheckpointerService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(PostgresCheckpointerService_1.name);
        this.pool = null;
        this.saver = null;
    }
    async onModuleInit() {
        await this.initialize();
    }
    async onModuleDestroy() {
        await this.close();
    }
    async initialize() {
        try {
            const host = this.configService.get('DB_HOST') || 'localhost';
            const port = this.configService.get('DB_PORT') || 6012;
            const database = this.configService.get('DB_NAME') || 'postgres';
            const user = this.configService.get('DB_USER') || 'postgres';
            const password = this.configService.get('DB_PASSWORD') || 'postgres';
            const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
            this.logger.log(`Initializing PostgreSQL checkpointer: ${host}:${port}/${database}`);
            this.pool = new pg_1.Pool({
                connectionString,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            });
            const client = await this.pool.connect();
            try {
                await client.query('SELECT 1');
                this.logger.log('PostgreSQL connection test successful');
            }
            finally {
                client.release();
            }
            this.saver = langgraph_checkpoint_postgres_1.PostgresSaver.fromConnString(connectionString);
            await this.saver.setup();
            this.logger.log('PostgreSQL checkpointer initialized successfully');
        }
        catch (error) {
            this.logger.error(`Failed to initialize PostgreSQL checkpointer: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.saver = null;
            this.logger.log('PostgreSQL checkpointer closed');
        }
    }
    getSaver() {
        if (!this.saver) {
            throw new Error('PostgreSQL checkpointer not initialized');
        }
        return this.saver;
    }
    getPool() {
        if (!this.pool) {
            throw new Error('PostgreSQL connection pool not initialized');
        }
        return this.pool;
    }
    isReady() {
        return this.saver !== null && this.pool !== null;
    }
    async healthCheck() {
        if (!this.pool) {
            return false;
        }
        try {
            const client = await this.pool.connect();
            try {
                await client.query('SELECT 1');
                return true;
            }
            finally {
                client.release();
            }
        }
        catch {
            return false;
        }
    }
};
exports.PostgresCheckpointerService = PostgresCheckpointerService;
exports.PostgresCheckpointerService = PostgresCheckpointerService = PostgresCheckpointerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PostgresCheckpointerService);
//# sourceMappingURL=postgres-checkpointer.service.js.map