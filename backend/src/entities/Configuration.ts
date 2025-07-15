import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class Configuration {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string; // A user-friendly name for the configuration

    @Column({ type: 'jsonb' }) // Use jsonb for efficient querying in PostgreSQL
    settings!: object; // Store the entire settings object here

    @CreateDateColumn()
    createdAt!: Date;
}