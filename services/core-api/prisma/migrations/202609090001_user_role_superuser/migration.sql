ALTER TABLE "User" DROP CONSTRAINT "User_role_check";
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('user', 'superuser', 'admin'));
