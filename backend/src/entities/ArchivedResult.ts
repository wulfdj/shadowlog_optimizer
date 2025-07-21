import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, ManyToMany, JoinTable, Index } from "typeorm";
import { Configuration } from "./Configuration";
import { Tag } from "./Tag";

@Entity()
export class ArchivedResult {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column({ type: 'varchar', length: 20 })
    instrument!: string;

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

    //@Column({ type: 'jsonb' })
    //configurationData!: object; // Store the full configuration object

    @CreateDateColumn()
    archivedAt!: Date;

    @ManyToMany(() => Tag, { eager: true, cascade: true })
    @JoinTable() // This creates the join table (e.g., archived_result_tags_tag)
    tags!: Tag[];
}