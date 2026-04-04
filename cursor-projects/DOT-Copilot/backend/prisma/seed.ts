import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a fleet
  const fleet = await prisma.fleet.upsert({
    where: { id: 'fleet-1' },
    update: {},
    create: {
      id: 'fleet-1',
      companyName: 'Demo Trucking Company',
      locations: 'New York, Los Angeles, Chicago',
      cargoType: 'General Freight',
      cdlStatus: 'Class A',
      vehicleTypes: 'Semi-trucks, Box trucks',
      keyRiskAreas: 'Urban driving, Highway safety',
      operationType: 'Long-haul',
      statesOfOperation: 'NY, CA, IL, TX',
      onboardingCompleted: true,
      complianceProfileConfigured: true,
    },
  });
  console.log('Created fleet:', fleet.companyName);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: 'ADMIN',
      fleetId: fleet.id,
    },
  });
  console.log('Created admin:', admin.email);

  // Create supervisor user
  const supervisorPassword = await bcrypt.hash('supervisor123', 12);
  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@example.com' },
    update: {},
    create: {
      email: 'supervisor@example.com',
      name: 'Supervisor User',
      passwordHash: supervisorPassword,
      role: 'SUPERVISOR',
      fleetId: fleet.id,
    },
  });
  console.log('Created supervisor:', supervisor.email);

  // Create driver user
  const driverPassword = await bcrypt.hash('driver123456', 12);
  const driver = await prisma.user.upsert({
    where: { email: 'driver@example.com' },
    update: {},
    create: {
      email: 'driver@example.com',
      name: 'Driver User',
      passwordHash: driverPassword,
      role: 'DRIVER',
      fleetId: fleet.id,
    },
  });
  console.log('Created driver:', driver.email);

  // Create training program
  const program = await prisma.trainingProgram.upsert({
    where: { id: 'program-1' },
    update: {},
    create: {
      id: 'program-1',
      programName: 'New Driver Orientation',
      description: 'Complete orientation program for new drivers',
      isRecommended: true,
      fleetId: fleet.id,
    },
  });
  console.log('Created training program:', program.programName);

  // Create module
  const module1 = await prisma.module.upsert({
    where: { id: 'module-1' },
    update: {},
    create: {
      id: 'module-1',
      moduleName: 'Safety Fundamentals',
      description: 'Learn the basics of truck driving safety',
      sequenceOrder: 1,
      fleetId: fleet.id,
      trainingProgramId: program.id,
    },
  });
  console.log('Created module:', module1.moduleName);

  // Create lessons
  const lesson1 = await prisma.lesson.upsert({
    where: { id: 'lesson-1' },
    update: {},
    create: {
      id: 'lesson-1',
      lessonName: 'Pre-Trip Inspection',
      content: 'Learn how to conduct a thorough pre-trip inspection of your vehicle.',
      contentType: 'TEXT',
      sequenceOrder: 1,
      requiresEsignature: false,
      fleetId: fleet.id,
      moduleId: module1.id,
    },
  });
  console.log('Created lesson:', lesson1.lessonName);

  const lesson2 = await prisma.lesson.upsert({
    where: { id: 'lesson-2' },
    update: {},
    create: {
      id: 'lesson-2',
      lessonName: 'Defensive Driving',
      content: 'Master defensive driving techniques for commercial vehicles.',
      contentType: 'TEXT',
      sequenceOrder: 2,
      requiresEsignature: true,
      fleetId: fleet.id,
      moduleId: module1.id,
    },
  });
  console.log('Created lesson:', lesson2.lessonName);

  // Create quiz questions
  await prisma.quizQuestion.upsert({
    where: { id: 'question-1' },
    update: {},
    create: {
      id: 'question-1',
      questionText: 'What is the first step in a pre-trip inspection?',
      answerOptions: JSON.stringify(['Check the engine', 'Walk around the vehicle', 'Start the engine', 'Check the mirrors']),
      correctAnswer: 'Walk around the vehicle',
      sequenceOrder: 1,
      lessonId: lesson1.id,
    },
  });

  await prisma.quizQuestion.upsert({
    where: { id: 'question-2' },
    update: {},
    create: {
      id: 'question-2',
      questionText: 'What is the recommended following distance for a commercial truck?',
      answerOptions: JSON.stringify(['2 seconds', '4 seconds', '6 seconds', '1 second']),
      correctAnswer: '4 seconds',
      sequenceOrder: 1,
      lessonId: lesson2.id,
    },
  });
  console.log('Created quiz questions');

  // Create assignment for driver
  const assignment = await prisma.assignment.upsert({
    where: { id: 'assignment-1' },
    update: {},
    create: {
      id: 'assignment-1',
      status: 'pending',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      userId: driver.id,
      fleetId: fleet.id,
      trainingProgramId: program.id,
    },
  });
  console.log('Created assignment for driver');

  // Create notification
  await prisma.notification.upsert({
    where: { id: 'notification-1' },
    update: {},
    create: {
      id: 'notification-1',
      message: `You have been assigned: ${program.programName}`,
      notificationType: 'ASSIGNMENT',
      isRead: false,
      userId: driver.id,
      fleetId: fleet.id,
      relatedAssignmentId: assignment.id,
    },
  });
  console.log('Created notification');

  console.log('Seeding complete!');
  console.log('\nTest credentials:');
  console.log('  Admin: admin@example.com / admin123456');
  console.log('  Supervisor: supervisor@example.com / supervisor123');
  console.log('  Driver: driver@example.com / driver123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

