import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class ArchivedResult {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string; // A user-defined name for this saved strategy

    @Column({ type: 'text', nullable: true })
    notes?: string; // Optional user notes about why this strategy is good

    // We store the full result object, which includes the combination, metrics, etc.
    @Column({ type: 'jsonb' })
    resultData!: object; 

    @Column({ type: 'jsonb' })
    configurationData!: object; // Store the full configuration object

    @CreateDateColumn()
    archivedAt!: Date;
}