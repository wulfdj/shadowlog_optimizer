import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { Configuration } from "./Configuration";

@Entity()
export class ArchivedResult {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string; // A user-defined name for this saved strategy

    @Column({ type: 'text', nullable: true })
    notes?: string; // Optional user notes about why this strategy is good

    // eager: true means the config will be automatically loaded when we fetch an ArchivedResult.
    @ManyToOne(() => Configuration, { eager: true, onDelete: 'CASCADE' })
    configuration!: Configuration;

    @Column({ type: 'varchar', length: 100, nullable: true }) // nullable for backwards compatibility
    strategyName?: string;

    // We store the full result object, which includes the combination, metrics, etc.
    @Column({ type: 'jsonb' })
    resultData!: object; 

    @Column({ type: 'jsonb' })
    configurationData!: object; // Store the full configuration object

    @CreateDateColumn()
    archivedAt!: Date;
}