import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
export declare class PostgresCheckpointerService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private pool;
    private saver;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private initialize;
    private close;
    getSaver(): PostgresSaver;
    getPool(): Pool;
    isReady(): boolean;
    healthCheck(): Promise<boolean>;
}
