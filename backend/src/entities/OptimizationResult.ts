import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from "typeorm";
import { Configuration } from "./Configuration";

@Entity()
export class OptimizationResult {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column({ type: 'varchar', length: 20 })
    instrument!: string;

    @ManyToOne(() => Configuration, { eager: true })
    configuration!: Configuration;

    @Column({ type: 'jsonb' })
    results!: object;

    // --- NEW COLUMN ---
    @Column({ type: 'timestamp' })
    startedAt!: Date;

    @CreateDateColumn() // This already provides the end time
    completedAt!: Date;
}