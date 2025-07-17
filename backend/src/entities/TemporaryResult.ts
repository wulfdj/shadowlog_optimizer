import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity()
export class TemporaryResult {
    @PrimaryGeneratedColumn()
    id!: number;

    // We link each temporary result back to the master BullMQ job that created it.
    @Index()
    @Column({ type: 'varchar' })
    jobId!: string;

    // We store the full result object as JSON.
    @Column({ type: 'jsonb' })
    resultData!: object;

    // We also store the overall score separately for efficient sorting.
    @Index()
    @Column({ type: 'float' })
    overallScore!: number;
}