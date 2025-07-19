import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToMany } from "typeorm";
import { ArchivedResult } from "./ArchivedResult";

@Entity()
export class Tag {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index({ unique: true }) // Tag names must be unique
    @Column({ type: 'varchar', length: 50 })
    name!: string;

    @Column({ type: 'varchar', length: 20 })
    color!: string; // e.g., 'blue', '#FF5733', 'rgb(255, 87, 51)'

    // Define the other side of the many-to-many relationship
    @ManyToMany(() => ArchivedResult, (archive) => archive.tags)
    archivedResults!: ArchivedResult[];
}