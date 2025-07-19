import "reflect-metadata";
import { DataSource } from "typeorm";
import { Trade } from "../entities/Trade";
import { Configuration } from "../entities/Configuration";
import { OptimizationResult } from "../entities/OptimizationResult";
import { ArchivedResult } from "../entities/ArchivedResult";
import { TemporaryResult } from "../entities/TemporaryResult";
import { Tag } from "../entities/Tag";

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [Trade, Configuration, OptimizationResult, ArchivedResult, TemporaryResult, Tag],
    synchronize: true, // Auto-creates DB tables. Good for dev, but use migrations in production.
    logging: false,
    
});