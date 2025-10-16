import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('vaccines')
export class Vaccine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;
}


