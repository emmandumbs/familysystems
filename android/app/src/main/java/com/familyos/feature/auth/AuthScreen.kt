package com.familyos.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Warm Ivory & Forest Green Palette
val IvoryBackground = Color(0xFFF7F4EC)
val ForestGreenPrimary = Color(0xFF173D35)
val WarmSandCard = Color(0xFFFFFFFF)
val MutedSlateText = Color(0xFF5A625E)
val AlertRed = Color(0xFFC0392B)
val SuccessGreen = Color(0xFF27AE60)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    currentEmail: String? = null,
    isEmailVerified: Boolean = true,
    isLoading: Boolean = false,
    errorMessage: String? = null,
    onSignInWithEmail: (email: String, pass: String) -> Unit,
    onRegisterWithEmail: (email: String, pass: String) -> Unit,
    onSignInWithGoogle: () -> Unit,
    onSendPasswordReset: (email: String) -> Unit,
    onSendEmailVerification: () -> Unit,
    onContinueOffline: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isRegisterMode by remember { mutableStateOf(false) }
    var emailInput by remember { mutableStateOf(currentEmail ?: "") }
    var passwordInput by remember { mutableStateOf("") }
    var showForgotPasswordDialog by remember { mutableStateOf(false) }
    var resetEmailInput by remember { mutableStateOf("") }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(IvoryBackground)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // App Header Brand
        Surface(
            modifier = Modifier.size(72.dp),
            shape = RoundedCornerShape(20.dp),
            color = ForestGreenPrimary,
            tonalElevation = 4.dp
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "F",
                    color = IvoryBackground,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "FamilyOS",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = ForestGreenPrimary
        )

        Text(
            text = "Private Family Operations System",
            fontSize = 14.sp,
            color = MutedSlateText,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Email Verification Warning Banner if logged in but unverified
        if (currentEmail != null && !isEmailVerified) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3CD)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = "Unverified Email",
                        tint = Color(0xFF856404),
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Email Address Unverified",
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF856404),
                            fontSize = 14.sp
                        )
                        Text(
                            text = "Please check $currentEmail to verify your account.",
                            color = Color(0xFF856404),
                            fontSize = 12.sp
                        )
                    }
                    Button(
                        onClick = onSendEmailVerification,
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Resend", fontSize = 12.sp)
                    }
                }
            }
        }

        // Auth Container Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = WarmSandCard),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = if (isRegisterMode) "Create Family Account" else "Welcome Back",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForestGreenPrimary
                )

                Spacer(modifier = Modifier.height(20.dp))

                if (errorMessage != null) {
                    Text(
                        text = errorMessage,
                        color = AlertRed,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                if (statusMessage != null) {
                    Text(
                        text = statusMessage!!,
                        color = SuccessGreen,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                // Email Input Field
                OutlinedTextField(
                    value = emailInput,
                    onValueChange = { emailInput = it },
                    label = { Text("Email Address") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = ForestGreenPrimary) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ForestGreenPrimary,
                        focusedLabelColor = ForestGreenPrimary
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Password Input Field
                OutlinedTextField(
                    value = passwordInput,
                    onValueChange = { passwordInput = it },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = ForestGreenPrimary) },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = ForestGreenPrimary,
                        focusedLabelColor = ForestGreenPrimary
                    )
                )

                if (!isRegisterMode) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.End
                    ) {
                        TextButton(
                            onClick = {
                                resetEmailInput = emailInput
                                showForgotPasswordDialog = true
                            }
                        ) {
                            Text("Forgot password?", color = ForestGreenPrimary, fontSize = 12.sp)
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Submit Button
                Button(
                    onClick = {
                        if (emailInput.isBlank() || passwordInput.isBlank()) {
                            statusMessage = "Please fill in all fields."
                            return@Button
                        }
                        statusMessage = null
                        if (isRegisterMode) {
                            onRegisterWithEmail(emailInput, passwordInput)
                        } else {
                            onSignInWithEmail(emailInput, passwordInput)
                        }
                    },
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            color = IvoryBackground,
                            modifier = Modifier.size(20.dp)
                        )
                    } else {
                        Text(
                            text = if (isRegisterMode) "Register" else "Sign In",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Color.LightGray)
                    Text(
                        text = " OR ",
                        fontSize = 12.sp,
                        color = MutedSlateText,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f), color = Color.LightGray)
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Google Sign-In Button
                OutlinedButton(
                    onClick = onSignInWithGoogle,
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Continue with Google",
                        color = ForestGreenPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Mode Switch Text
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isRegisterMode) "Already have an account?" else "Don't have an account?",
                        fontSize = 13.sp,
                        color = MutedSlateText
                    )
                    TextButton(onClick = { isRegisterMode = !isRegisterMode }) {
                        Text(
                            text = if (isRegisterMode) "Sign In" else "Register",
                            color = ForestGreenPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Offline Workspace Option
        TextButton(onClick = onContinueOffline) {
            Text(
                text = "Continue with Offline Local Workspace",
                color = ForestGreenPrimary,
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
            )
        }
    }

    // Forgot Password Dialog Modal
    if (showForgotPasswordDialog) {
        AlertDialog(
            onDismissRequest = { showForgotPasswordDialog = false },
            title = {
                Text("Reset Password", color = ForestGreenPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column {
                    Text(
                        "Enter your account email address. We will send a password reset link to it.",
                        fontSize = 13.sp,
                        color = MutedSlateText
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = resetEmailInput,
                        onValueChange = { resetEmailInput = it },
                        label = { Text("Email Address") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (resetEmailInput.isNotBlank()) {
                            onSendPasswordReset(resetEmailInput)
                            statusMessage = "Password reset email sent to $resetEmailInput"
                            showForgotPasswordDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreenPrimary)
                ) {
                    Text("Send Reset Link")
                }
            },
            dismissButton = {
                TextButton(onClick = { showForgotPasswordDialog = false }) {
                    Text("Cancel", color = MutedSlateText)
                }
            }
        )
    }
}
